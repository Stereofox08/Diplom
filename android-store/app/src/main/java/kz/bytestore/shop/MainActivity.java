package kz.bytestore.shop;

import static kz.bytestore.shop.Ui.*;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.text.*;
import android.text.method.PasswordTransformationMethod;
import android.view.*;
import android.view.inputmethod.*;
import android.widget.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;
import org.json.*;

public final class MainActivity extends Activity {
  private Store store;
  private Api api;
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final Handler main = new Handler(Looper.getMainLooper());
  private LinearLayout searchHost;
  private EditText globalSearch;
  private Button cityButton, upButton;
  private ImageView appMark;
  private boolean changingSearch, saleOnly;
  private LinearLayout content, nav, header;
  private TextView status, title;
  private ProgressBar progress;
  private final TextView[] navLabels = new TextView[5];
  private final Ui.NavIcon[] navIcons = new Ui.NavIcon[5];
  private final String[] tabs = {"home", "categories", "favorites", "cart", "profile"},
      tabNames = {"Главная", "Каталог", "Избранное", "Корзина", "Профиль"};
  private String screen = "home",
      productId = "",
      query = "",
      category = "",
      sort = "Популярные",
      promo = "";
  private boolean onlyStock, refreshing, verificationFailed, foreground;
  private int selected = 0, pending = 0;
  private long verifiedAt = 0, exitAt = 0;
  private GridView grid;
  private ProductAdapter adapter;
  private TextView resultCount;
  private ScrollView scroll;
  private final ArrayDeque<String[]> history = new ArrayDeque<>();
  private final Runnable poll =
      new Runnable() {
        public void run() {
          if (foreground) {
            refresh();
            main.postDelayed(this, 45000);
          }
        }
      };

  interface Task<T> {
    T run() throws Exception;
  }

  @Override
  public void onCreate(Bundle saved) {
    Ui.applyTheme(this);
    setTheme(Ui.dark(this) ? R.style.AppThemeDark : R.style.AppTheme);
    super.onCreate(saved);
    store = new Store(this);
    api = new Api(store);
    getWindow().setStatusBarColor(BG);
    getWindow().setNavigationBarColor(SURFACE);
    getWindow()
        .getDecorView()
        .setSystemUiVisibility(
            Ui.dark(this)
                ? 0
                : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
    LinearLayout root = column(this);
    root.setBackgroundColor(BG);
    root.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          int top, bottom, left, right;
          boolean keyboard = false;
          if (Build.VERSION.SDK_INT >= 30) {
            android.graphics.Insets bars =
                insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            top = bars.top;
            bottom = bars.bottom;
            left = bars.left;
            right = bars.right;
            keyboard = insets.isVisible(WindowInsets.Type.ime());
            if (keyboard)
              bottom = Math.max(bottom, insets.getInsets(WindowInsets.Type.ime()).bottom);
          } else {
            top = insets.getSystemWindowInsetTop();
            bottom = insets.getSystemWindowInsetBottom();
            left = insets.getSystemWindowInsetLeft();
            right = insets.getSystemWindowInsetRight();
          }
          root.setPadding(left, top, right, bottom);
          if (nav != null) nav.setVisibility(keyboard ? View.GONE : View.VISIBLE);
          return Build.VERSION.SDK_INT >= 30
              ? WindowInsets.CONSUMED
              : insets.consumeSystemWindowInsets();
        });
    header = column(this);
    header.setPadding(d(16), d(8), d(16), d(12));
    header.setBackgroundColor(SURFACE);
    LinearLayout bar = row(this);
    appMark = new ImageView(this);
    appMark.setImageResource(R.drawable.ic_brand_mark);
    bar.addView(appMark, new LinearLayout.LayoutParams(d(30), d(30)));
    appMark.setOnClickListener(v -> tab(0));
    upButton = button(this, "‹", false);
    upButton.setPadding(0, 0, 0, 0);
    upButton.setTextSize(27);
    upButton.setContentDescription("Назад");
    bar.addView(upButton, new LinearLayout.LayoutParams(d(32), d(36)));
    upButton.setOnClickListener(v -> onBackPressed());
    title = text(this, "ByteStore", 19, TEXT, true);
    title.setSingleLine(true);
    title.setEllipsize(TextUtils.TruncateAt.END);
    LinearLayout.LayoutParams titleLayout = new LinearLayout.LayoutParams(0, -2, 1);
    titleLayout.leftMargin = d(8);
    bar.addView(title, titleLayout);
    cityButton = button(this, store.city() + " ⌄", false);
    cityButton.setTextSize(11);
    cityButton.setPadding(d(6), d(2), d(6), d(2));
    cityButton.setSingleLine(true);
    cityButton.setEllipsize(TextUtils.TruncateAt.END);
    cityButton.setMaxWidth(d(155));
    cityButton.setContentDescription("Город доставки");
    bar.addView(cityButton, new LinearLayout.LayoutParams(-2, d(36)));
    cityButton.setOnClickListener(v -> chooseCity());
    add(header, bar);
    searchHost = row(this);
    LinearLayout.LayoutParams sh = new LinearLayout.LayoutParams(-1, -2);
    sh.topMargin = d(10);
    header.addView(searchHost, sh);
    globalSearch = field(this, "Поиск в ByteStore", android.text.InputType.TYPE_CLASS_TEXT);
    globalSearch.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_search, 0, 0, 0);
    globalSearch.setCompoundDrawablePadding(d(10));
    globalSearch.setContentDescription("Поиск товаров");
    globalSearch.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
    searchHost.addView(globalSearch, new LinearLayout.LayoutParams(0, d(46), 1));
    ImageButton refresh = new ImageButton(this);
    refresh.setImageResource(R.drawable.ic_refresh);
    refresh.setPadding(d(10), d(10), d(10), d(10));
    refresh.setBackground(background(this, PANEL, 11));
    refresh.setContentDescription("Обновить каталог");
    LinearLayout.LayoutParams refreshLayout = new LinearLayout.LayoutParams(d(44), d(46));
    refreshLayout.leftMargin = d(8);
    searchHost.addView(refresh, refreshLayout);
    refresh.setOnClickListener(v -> refresh());
    add(root, header);
    globalSearch.addTextChangedListener(
        new TextWatcher() {
          public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

          public void afterTextChanged(Editable e) {}

          public void onTextChanged(CharSequence s, int start, int before, int count) {
            if (changingSearch) return;
            query = s.toString();
            if (screen.equals("catalog") || screen.equals("favorites")) {
              if (adapter != null) {
                adapter.reload();
                if (resultCount != null)
                  resultCount.setText("Найдено " + adapter.items.size() + " товаров");
              }
            } else if (!query.trim().isEmpty()) {
              history.push(new String[] {screen, productId});
              screen = "catalog";
              selected = 1;
              category = "";
              saleOnly = false;
              render();
              globalSearch.requestFocus();
            }
          }
        });
    globalSearch.setOnEditorActionListener(
        (v, action, event) -> {
          hideKeyboard();
          return true;
        });
    progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
    progress.setIndeterminate(true);
    progress.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(ACCENT));
    root.addView(progress, new LinearLayout.LayoutParams(-1, d(2)));
    status = text(this, "", 11, MUTED, false);
    status.setPadding(d(16), d(6), d(16), d(6));
    status.setBackgroundColor(PANEL);
    add(root, status);
    content = column(this);
    root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
    nav = row(this);
    nav.setBackgroundColor(SURFACE);
    for (int i = 0; i < 5; i++) {
      final int index = i;
      LinearLayout item = column(this);
      item.setGravity(Gravity.CENTER);
      item.setContentDescription(tabNames[i]);
      item.setClickable(true);
      item.setFocusable(true);
      navIcons[i] = new Ui.NavIcon(this, i);
      item.addView(navIcons[i], new LinearLayout.LayoutParams(d(24), d(24)));
      navLabels[i] = text(this, tabNames[i], 10, MUTED, false);
      navLabels[i].setGravity(Gravity.CENTER);
      LinearLayout.LayoutParams label = new LinearLayout.LayoutParams(-1, -2);
      label.topMargin = d(4);
      item.addView(navLabels[i], label);
      nav.addView(item, new LinearLayout.LayoutParams(0, d(64), 1));
      item.setOnClickListener(v -> tab(index));
    }
    add(root, nav);
    setContentView(root);
    root.requestApplyInsets();
    if (saved != null) {
      screen = saved.getString("screen", "home");
      productId = saved.getString("product", "");
      query = saved.getString("query", "");
      category = saved.getString("category", "");
      selected = saved.getInt("tab", 0);
    }
    render();
  }

  private int d(float value) {
    return Ui.dp(this, value);
  }

  private void toast(String message) {
    Toast.makeText(this, message, Toast.LENGTH_LONG).show();
  }

  private boolean verified() {
    return verifiedAt > 0 && SystemClock.elapsedRealtime() - verifiedAt < 90000;
  }

  private boolean buyable(JSONObject p) {
    return verified()
        && p != null
        && p.optInt("stock") > 0
        && "active".equals(p.optString("status", "active"))
        && (store.state.optJSONObject("settings") == null
            || !store.state.optJSONObject("settings").optBoolean("maintenance"));
  }

  private void badges() {
    for (int i = 0; i < 5; i++) {
      navIcons[i].active = i == selected;
      navIcons[i].invalidate();
      navLabels[i].setTextColor(i == selected ? ACCENT : MUTED);
    }
    navIcons[2].badge = store.favorites.size();
    navIcons[3].badge = store.count();
    navIcons[2].invalidate();
    navIcons[3].invalidate();
  }

  private void setStatus() {
    progress.setVisibility(pending > 0 || refreshing ? View.VISIBLE : View.INVISIBLE);
    status.setText(
        refreshing
            ? "Обновляем цены и наличие…"
            : verified()
                ? "Наличие обновлено"
                : verificationFailed ? "Нет связи · покупки недоступны" : "Проверяем наличие…");
    status.setTextColor(MUTED);
    status.setVisibility(verificationFailed && !refreshing ? View.VISIBLE : View.GONE);
  }

  private <T> void async(Task<T> work, Consumer<T> success) {
    pending++;
    setStatus();
    worker.execute(
        () -> {
          try {
            T result = work.run();
            main.post(
                () -> {
                  if (isFinishing() || isDestroyed()) return;
                  pending--;
                  setStatus();
                  success.accept(result);
                });
          } catch (Exception e) {
            main.post(
                () -> {
                  if (isFinishing() || isDestroyed()) return;
                  pending--;
                  setStatus();
                  if (store.session == null && !store.owner.equals("guest")) {
                    store.changeOwner(false);
                    store.state.remove("users");
                    store.state.remove("orders");
                    render();
                  }
                  new AlertDialog.Builder(this)
                      .setTitle("ByteStore")
                      .setMessage(
                          e.getMessage() == null ? "Не удалось выполнить действие" : e.getMessage())
                      .setPositiveButton("Понятно", null)
                      .show();
                });
          }
        });
  }

  private void refresh() {
    if (refreshing) return;
    refreshing = true;
    setStatus();
    worker.execute(
        () -> {
          try {
            JSONObject snapshot = api.snapshot();
            store.cachePublic(snapshot);
            main.post(
                () -> {
                  if (isDestroyed()) return;
                  store.applySnapshot(snapshot);
                  verifiedAt = SystemClock.elapsedRealtime();
                  verificationFailed = false;
                  refreshing = false;
                  updateData();
                });
          } catch (Exception e) {
            main.post(
                () -> {
                  if (isDestroyed()) return;
                  verifiedAt = 0;
                  verificationFailed = true;
                  refreshing = false;
                  if (store.session == null && !store.owner.equals("guest")) {
                    store.changeOwner(false);
                    store.state.remove("users");
                    store.state.remove("orders");
                  }
                  updateData();
                });
          }
        });
  }

  private void updateData() {
    setStatus();
    if (adapter != null) {
      adapter.reload();
      if (resultCount != null) resultCount.setText("Найдено " + adapter.items.size() + " товаров");
    } else if (!Arrays.asList("login", "register", "reset", "checkout", "edit_profile", "builder")
        .contains(screen)) {
      int y = scroll == null ? 0 : scroll.getScrollY();
      render();
      if (scroll != null) {
        ScrollView target = scroll;
        target.post(() -> target.scrollTo(0, y));
      }
    }
    badges();
  }

  private void hideKeyboard() {
    View focus = getCurrentFocus();
    if (focus != null) {
      ((InputMethodManager) getSystemService(INPUT_METHOD_SERVICE))
          .hideSoftInputFromWindow(focus.getWindowToken(), 0);
      focus.clearFocus();
    }
  }

  private void tab(int index) {
    hideKeyboard();
    selected = index;
    if (index == 0 || index == 1 || index == 2) {
      category = "";
      query = "";
      onlyStock = false;
      saleOnly = false;
    }
    history.clear();
    screen = tabs[index];
    productId = "";
    render();
  }

  private void navigate(String next, String id) {
    hideKeyboard();
    history.push(new String[] {screen, productId});
    screen = next;
    productId = id == null ? "" : id;
    render();
  }

  private void render() {
    content.removeAllViews();
    adapter = null;
    grid = null;
    resultCount = null;
    scroll = null;
    badges();
    setStatus();
    updateHeader();
    switch (screen) {
      case "categories":
        categories();
        break;
      case "edit_profile":
        editProfile();
        break;
      case "catalog":
      case "favorites":
        catalog();
        break;
      case "product":
        detail();
        break;
      case "cart":
        cart();
        break;
      case "profile":
        profile();
        break;
      case "login":
        login(false);
        break;
      case "register":
        login(true);
        break;
      case "reset":
        resetPassword();
        break;
      case "checkout":
        checkout();
        break;
      case "builder":
        builder();
        break;
      case "orders":
        orders();
        break;
      default:
        home();
    }
  }

  private LinearLayout page() {
    scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    LinearLayout body = column(this);
    body.setPadding(d(16), d(20), d(16), d(24));
    scroll.addView(body);
    content.addView(scroll, new LinearLayout.LayoutParams(-1, -1));
    return body;
  }

  private void heading(LinearLayout body, String kicker, String heading, String sub) {
    if (screen.equals("product") && !kicker.isEmpty())
      section(body, text(this, kicker.toUpperCase(new Locale("ru")), 11, ACCENT, true));
    TextView headline = text(this, heading, 23, TEXT, true);
    if (heading.contains("\n")) {
      android.text.SpannableString span = new android.text.SpannableString(heading);
      span.setSpan(
          new android.text.style.ForegroundColorSpan(ACCENT),
          heading.indexOf("\n") + 1,
          heading.length(),
          0);
      headline.setText(span);
    }
    section(body, headline);
    if (!sub.isEmpty()) section(body, text(this, sub, 14, MUTED, false));
  }

  private Button action(LinearLayout body, String label, boolean primary, Runnable run) {
    Button b = button(this, label, primary);
    section(body, b);
    b.setOnClickListener(v -> run.run());
    return b;
  }

  private TextView availability(JSONObject p) {
    String message =
        !verified()
            ? (verificationFailed ? "Наличие не проверено" : "Проверяем наличие…")
            : p.optInt("stock") > 0 ? "В наличии · " + p.optInt("stock") + " шт." : "Нет в наличии";
    return text(this, message, 11, verified() && p.optInt("stock") > 0 ? GREEN : MUTED, false);
  }

  private void addProduct(JSONObject p) {
    if (!verified()) {
      toast("Сначала проверим актуальное наличие");
      refresh();
      return;
    }
    if (!buyable(p) || !store.add(p.optString("id"))) {
      toast("Доступного количества нет в наличии");
      return;
    }
    badges();
    toast("Добавлено в корзину");
  }

  private void home() {
    LinearLayout body = page();
    body.setPadding(d(16), d(14), d(16), d(24));
    HorizontalScrollView strip = new HorizontalScrollView(this);
    strip.setHorizontalScrollBarEnabled(false);
    LinearLayout categories = row(this);
    List<JSONObject> categoryList = new ArrayList<>();
    JSONObject ready = store.category("prebuilt");
    if (ready != null) categoryList.add(ready);
    for (int i = 0; i < store.array("categories").length(); i++) {
      JSONObject c = store.array("categories").optJSONObject(i);
      if (!c.optString("id").equals("prebuilt")) categoryList.add(c);
    }
    for (JSONObject c : categoryList) {
      LinearLayout tile = column(this);
      tile.setGravity(Gravity.CENTER_HORIZONTAL);
      Ui.Art icon = new Ui.Art(this, c.optString("id"));
      tile.addView(icon, new LinearLayout.LayoutParams(d(68), d(60)));
      gap(tile, 8);
      TextView name = text(this, c.optString("name"), 11, TEXT, false);
      name.setGravity(Gravity.CENTER);
      name.setMaxLines(2);
      name.setMinLines(2);
      add(tile, name);
      LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(d(92), -2);
      lp.rightMargin = d(8);
      categories.addView(tile, lp);
      tile.setContentDescription("Категория: " + c.optString("name"));
      tile.setOnClickListener(v -> openCategory(c.optString("id")));
    }
    strip.addView(categories);
    section(body, strip);
    gap(body, 3);
    LinearLayout shortcuts = row(this);
    quick(
        shortcuts,
        5,
        "Мои\nзаказы",
        () -> {
          if (store.session == null) navigate("login", null);
          else navigate("orders", null);
        });
    quick(shortcuts, 6, "Собрать\nПК", () -> navigate("builder", null));
    quick(
        shortcuts,
        7,
        "Товары\nсо скидкой",
        () -> {
          saleOnly = true;
          category = "";
          query = "";
          selected = 1;
          navigate("catalog", null);
        });
    quick(shortcuts, 2, "Избранное", () -> tab(2));
    section(body, shortcuts);
    gap(body, 10);
    LinearLayout heading = row(this);
    TextView headingText = text(this, "Вам может понравиться", 19, TEXT, true);
    heading.addView(headingText, new LinearLayout.LayoutParams(0, -2, 1));
    TextView all = text(this, "Все  ›", 12, ACCENT, true);
    heading.addView(all);
    all.setOnClickListener(v -> openCategory(""));
    section(body, heading);
    List<JSONObject> selected = new ArrayList<>();
    Set<String> added = new HashSet<>();
    for (String cat :
        new String[] {
          "gpu",
          "cpu",
          "motherboard",
          "prebuilt",
          "storage",
          "monitor",
          "ram",
          "psu",
          "case",
          "cooling",
          "peripherals"
        })
      for (JSONObject p : products(false))
        if (cat.equals(p.optString("categoryId")) && added.add(p.optString("id"))) {
          selected.add(p);
          break;
        }
    for (int i = 0; i < selected.size(); i += 2) {
      LinearLayout row = row(this);
      row.setGravity(Gravity.TOP);
      for (int j = i; j < Math.min(i + 2, selected.size()); j++) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
        if (j == i) lp.rightMargin = d(10);
        row.addView(productCard(selected.get(j)), lp);
      }
      if (i == selected.size() - 1)
        row.addView(new View(this), new LinearLayout.LayoutParams(0, 1, 1));
      section(body, row);
    }
  }

  private void quick(LinearLayout parent, int type, String label, Runnable run) {
    LinearLayout item = column(this);
    item.setGravity(Gravity.CENTER);
    item.setPadding(d(4), d(10), d(4), d(8));
    item.setBackground(background(this, SURFACE, 13));
    Ui.NavIcon icon = new Ui.NavIcon(this, type);
    icon.active = true;
    item.addView(icon, new LinearLayout.LayoutParams(d(28), d(28)));
    gap(item, 7);
    TextView text = text(this, label, 10, TEXT, false);
    text.setGravity(Gravity.CENTER);
    text.setMinLines(2);
    text.setMaxLines(2);
    add(item, text);
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
    if (parent.getChildCount() > 0) lp.leftMargin = d(8);
    parent.addView(item, lp);
    item.setContentDescription(label.replace('\n', ' '));
    item.setOnClickListener(v -> run.run());
  }

  private void openCategory(String id) {
    category = id;
    query = "";
    saleOnly = false;
    selected = 1;
    navigate("catalog", null);
  }

  private void categories() {
    List<JSONObject> rows = new ArrayList<>();
    rows.add(Store.obj("id", "", "name", "Все товары"));
    for (int i = 0; i < store.array("categories").length(); i++)
      rows.add(store.array("categories").optJSONObject(i));
    ListView list = new ListView(this);
    list.setDivider(new android.graphics.drawable.ColorDrawable(BORDER));
    list.setDividerHeight(d(1));
    list.setAdapter(
        new BaseAdapter() {
          public int getCount() {
            return rows.size();
          }

          public Object getItem(int pos) {
            return rows.get(pos);
          }

          public long getItemId(int pos) {
            return pos;
          }

          public View getView(int pos, View convert, android.view.ViewGroup group) {
            JSONObject category = rows.get(pos);
            LinearLayout row = row(MainActivity.this);
            row.setPadding(d(16), d(14), d(16), d(14));
            row.setMinimumHeight(d(82));
            Ui.Art art = new Ui.Art(MainActivity.this, category.optString("id"));
            row.addView(art, new LinearLayout.LayoutParams(d(56), d(52)));
            TextView name = text(MainActivity.this, category.optString("name"), 16, TEXT, false);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
            lp.leftMargin = d(16);
            lp.rightMargin = d(12);
            row.addView(name, lp);
            row.addView(text(MainActivity.this, "›", 26, MUTED, false));
            return row;
          }
        });
    list.setOnItemClickListener((p, v, pos, id) -> openCategory(rows.get(pos).optString("id")));
    content.addView(list, new LinearLayout.LayoutParams(-1, -1));
  }

  private void updateHeader() {
    boolean root = Arrays.asList(tabs).contains(screen);
    upButton.setVisibility(root ? View.GONE : View.VISIBLE);
    appMark.setVisibility(root ? View.VISIBLE : View.GONE);
    String label;
    switch (screen) {
      case "home":
        label = "ByteStore";
        break;
      case "categories":
        label = "Каталог";
        break;
      case "catalog":
        JSONObject c = store.category(category);
        label = saleOnly ? "Скидки" : c == null ? "Все товары" : c.optString("name");
        break;
      case "favorites":
        label = "Избранное";
        break;
      case "cart":
        label = "Корзина";
        break;
      case "profile":
        label = "Профиль";
        break;
      case "orders":
        label = "Мои заказы";
        break;
      case "builder":
        label = "Собрать ПК";
        break;
      case "checkout":
        label = "Оформление";
        break;
      case "product":
        label = "Товар";
        break;
      case "edit_profile":
        label = "Личные данные";
        break;
      case "register":
        label = "Регистрация";
        break;
      default:
        label = "Вход";
    }
    if (screen.equals("home")) {
      android.text.SpannableString brand = new android.text.SpannableString("ByteStore");
      brand.setSpan(new android.text.style.ForegroundColorSpan(ACCENT), 4, 9, 0);
      title.setText(brand);
    } else title.setText(label);
    cityButton.setText(store.city() + " ⌄");
    cityButton.setVisibility(
        Arrays.asList("home", "categories", "catalog", "cart").contains(screen)
            ? View.VISIBLE
            : View.GONE);
    boolean search = Arrays.asList("home", "categories", "catalog", "favorites").contains(screen);
    searchHost.setVisibility(search ? View.VISIBLE : View.GONE);
    if (search && !globalSearch.getText().toString().equals(query)) {
      changingSearch = true;
      globalSearch.setText(query);
      globalSearch.setSelection(globalSearch.length());
      changingSearch = false;
    }
  }

  private void chooseCity() {
    List<String> cities =
        Arrays.asList(
            "Алматы",
            "Астана",
            "Петропавловск",
            "Шымкент",
            "Караганда",
            "Актобе",
            "Тараз",
            "Павлодар",
            "Семей",
            "Костанай",
            "Кокшетау",
            "Усть-Каменогорск",
            "Атырау",
            "Актау",
            "Уральск",
            "Кызылорда",
            "Туркестан");
    new AlertDialog.Builder(this)
        .setTitle("Город доставки")
        .setSingleChoiceItems(
            cities.toArray(new String[0]),
            cities.indexOf(store.city()),
            (dialog, pos) -> {
              store.city(cities.get(pos));
              dialog.dismiss();
              updateHeader();
              if (screen.equals("profile")) render();
            })
        .setNegativeButton("Отмена", null)
        .show();
  }

  private List<JSONObject> products(boolean favorites) {
    List<JSONObject> list = new ArrayList<>();
    JSONArray source = store.array("products");
    boolean filtering = screen.equals("catalog") || screen.equals("favorites");
    String q = filtering ? query.trim().toLowerCase(new Locale("ru")) : "";
    for (int i = 0; i < source.length(); i++) {
      JSONObject p = source.optJSONObject(i);
      if (p == null || !"active".equals(p.optString("status", "active"))) continue;
      if (favorites && !store.favorites.contains(p.optString("id"))) continue;
      if (filtering && !category.isEmpty() && !category.equals(p.optString("categoryId"))) continue;
      if (filtering && onlyStock && p.optInt("stock") <= 0) continue;
      if (filtering && saleOnly && p.optLong("oldPrice") <= p.optLong("price")) continue;
      if (!q.isEmpty()
          && !(p.optString("name")
                  + " "
                  + p.optString("brand")
                  + " "
                  + p.optString("sku")
                  + " "
                  + p.optString("key"))
              .toLowerCase(new Locale("ru"))
              .contains(q)) continue;
      list.add(p);
    }
    list.sort(
        (a, b) ->
            "Цена: по возрастанию".equals(sort)
                ? Long.compare(a.optLong("price"), b.optLong("price"))
                : "Цена: по убыванию".equals(sort)
                    ? Long.compare(b.optLong("price"), a.optLong("price"))
                    : "По названию".equals(sort)
                        ? a.optString("name").compareTo(b.optString("name"))
                        : Long.compare(b.optLong("sales"), a.optLong("sales")));
    return list;
  }

  private void catalog() {
    boolean favorites = screen.equals("favorites");
    LinearLayout top = column(this);
    top.setPadding(d(16), d(12), d(16), d(8));
    JSONObject current = store.category(category);
    String label =
        favorites
            ? "Избранное"
            : saleOnly
                ? "Товары со скидкой"
                : current == null ? "Все товары" : current.optString("name");
    LinearLayout controls = row(this);
    Button filter = button(this, "Фильтры" + (!category.isEmpty() || onlyStock ? " •" : ""), false),
        compare = button(this, "Сравнить · " + store.compare.size(), false);
    controls.addView(filter, new LinearLayout.LayoutParams(0, d(40), 1));
    LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(0, d(40), 1);
    cp.leftMargin = d(8);
    controls.addView(compare, cp);
    add(top, controls);
    filter.setOnClickListener(v -> filters());
    compare.setOnClickListener(v -> comparison());
    gap(top, 8);
    resultCount = text(this, "", 11, MUTED, false);
    add(top, resultCount);
    add(content, top);
    grid = new GridView(this);
    grid.setNumColumns(getResources().getConfiguration().screenWidthDp >= 700 ? 3 : 2);
    grid.setHorizontalSpacing(d(10));
    grid.setVerticalSpacing(d(10));
    grid.setPadding(d(16), 0, d(16), d(20));
    grid.setClipToPadding(false);
    grid.setStretchMode(GridView.STRETCH_COLUMN_WIDTH);
    adapter = new ProductAdapter(favorites);
    grid.setAdapter(adapter);
    content.addView(grid, new LinearLayout.LayoutParams(-1, 0, 1));
    resultCount.setText("Найдено " + adapter.items.size() + " товаров");
    TextView empty =
        text(
            this,
            favorites
                ? "Сохраняйте понравившиеся товары сердечком в каталоге"
                : "По вашему запросу ничего не найдено",
            15,
            MUTED,
            false);
    empty.setGravity(Gravity.CENTER);
    empty.setPadding(d(28), d(32), d(28), d(32));
    content.addView(empty, new LinearLayout.LayoutParams(-1, -2));
    grid.setEmptyView(empty);
  }

  private final class ProductAdapter extends BaseAdapter {
    List<JSONObject> items;
    final boolean favorites;

    ProductAdapter(boolean favorites) {
      this.favorites = favorites;
      items = products(favorites);
    }

    void reload() {
      items = products(favorites);
      notifyDataSetChanged();
    }

    public int getCount() {
      return items.size();
    }

    public Object getItem(int position) {
      return items.get(position);
    }

    public long getItemId(int position) {
      return items.get(position).optString("id").hashCode();
    }

    public View getView(int position, View convert, android.view.ViewGroup parent) {
      ProductTile tile = convert instanceof ProductTile ? (ProductTile) convert : new ProductTile();
      tile.bind(items.get(position));
      return tile;
    }
  }

  private LinearLayout productCard(JSONObject p) {
    ProductTile tile = new ProductTile();
    tile.bind(p);
    return tile;
  }

  private final class ProductTile extends LinearLayout {
    JSONObject product;
    final Ui.Art art;
    final TextView cat, name, stock, price;
    final Button buy, fav;

    ProductTile() {
      super(MainActivity.this);
      setOrientation(VERTICAL);
      setBackground(background(MainActivity.this, SURFACE, 15));
      setPadding(d(10), d(10), d(10), d(12));
      art = new Ui.Art(MainActivity.this, "cpu");
      addView(art, new LinearLayout.LayoutParams(-1, d(104)));
      art.setOnClickListener(v -> navigate("product", product.optString("id")));
      gap(this, 8);
      cat = text(MainActivity.this, "", 10, MUTED, false);
      add(this, cat);
      gap(this, 5);
      name = text(MainActivity.this, "", 13, TEXT, false);
      name.setMaxLines(3);
      name.setMinLines(3);
      name.setEllipsize(TextUtils.TruncateAt.END);
      add(this, name);
      name.setOnClickListener(v -> navigate("product", product.optString("id")));
      gap(this, 6);
      stock = text(MainActivity.this, "", 11, MUTED, false);
      stock.setSingleLine(true);
      stock.setEllipsize(TextUtils.TruncateAt.END);
      add(this, stock);
      gap(this, 6);
      price = text(MainActivity.this, "", 18, TEXT, true);
      add(this, price);
      gap(this, 8);
      LinearLayout actions = row(MainActivity.this);
      buy = button(MainActivity.this, "", true);
      buy.setTextSize(12);
      actions.addView(buy, new LinearLayout.LayoutParams(0, d(40), 1));
      buy.setOnClickListener(v -> addProduct(product));
      fav = button(MainActivity.this, "♡", false);
      fav.setTextSize(22);
      fav.setPadding(0, 0, 0, 0);
      fav.setMinWidth(0);
      fav.setMinimumWidth(0);
      LinearLayout.LayoutParams fp = new LinearLayout.LayoutParams(d(40), d(40));
      fp.leftMargin = d(5);
      actions.addView(fav, fp);
      fav.setOnClickListener(
          v -> {
            store.favorite(product.optString("id"));
            badges();
            if (screen.equals("favorites") && adapter != null) adapter.reload();
            else bind(product);
          });
      add(this, actions);
    }

    void bind(JSONObject p) {
      product = p;
      art.category = p.optString("categoryId");
      art.invalidate();
      JSONObject category = store.category(p.optString("categoryId"));
      cat.setText(category == null ? "ByteStore" : category.optString("name"));
      name.setText(p.optString("name"));
      stock.setText(
          !verified()
              ? (verificationFailed ? "Наличие не проверено" : "Проверяем наличие…")
              : p.optInt("stock") > 0
                  ? "В наличии · " + p.optInt("stock") + " шт."
                  : "Нет в наличии");
      stock.setTextColor(verified() && p.optInt("stock") > 0 ? GREEN : MUTED);
      price.setText(money(p.optLong("price")));
      boolean available = buyable(p);
      buy.setText(
          available
              ? "В корзину"
              : !verified() ? (verificationFailed ? "Нет связи" : "Проверяем…") : "Нет в наличии");
      buy.setEnabled(available);
      buy.setAlpha(available ? 1 : .45f);
      fav.setText(store.favorites.contains(p.optString("id")) ? "♥" : "♡");
      fav.setContentDescription(
          (store.favorites.contains(p.optString("id")) ? "Убрать из избранного: " : "В избранное: ")
              + p.optString("name"));
    }
  }

  private Spinner spinner(LinearLayout parent, String label, List<String> values, int selected) {
    if (!label.isEmpty()) {
      add(parent, text(this, label, 12, MUTED, true));
      gap(parent, 6);
    }
    Spinner spinner = new Spinner(this);
    ArrayAdapter<String> a =
        new ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, values) {
          @Override
          public View getView(int p, View v, android.view.ViewGroup group) {
            TextView t = (TextView) super.getView(p, v, group);
            t.setTextColor(TEXT);
            t.setTextSize(14);
            return t;
          }

          @Override
          public View getDropDownView(int p, View v, android.view.ViewGroup group) {
            TextView t = (TextView) super.getDropDownView(p, v, group);
            t.setTextColor(TEXT);
            t.setBackgroundColor(PANEL);
            t.setPadding(d(16), d(12), d(16), d(12));
            return t;
          }
        };
    a.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
    spinner.setAdapter(a);
    spinner.setSelection(Math.max(0, selected));
    spinner.setBackground(background(this, PANEL, 10));
    parent.addView(spinner, new LinearLayout.LayoutParams(-1, d(50)));
    gap(parent, 12);
    return spinner;
  }

  private void filters() {
    LinearLayout box = column(this);
    box.setPadding(d(20), d(12), d(20), d(8));
    List<String> names = new ArrayList<>(Collections.singletonList("Все категории")),
        ids = new ArrayList<>(Collections.singletonList(""));
    JSONArray categories = store.array("categories");
    for (int i = 0; i < categories.length(); i++) {
      JSONObject c = categories.optJSONObject(i);
      names.add(c.optString("name"));
      ids.add(c.optString("id"));
    }
    Spinner cats = spinner(box, "Категория", names, ids.indexOf(category));
    List<String> sorts =
        Arrays.asList("Популярные", "Цена: по возрастанию", "Цена: по убыванию", "По названию");
    Spinner sorting = spinner(box, "Сортировка", sorts, sorts.indexOf(sort));
    CheckBox available = new CheckBox(this);
    available.setText("Только в наличии");
    available.setTextColor(TEXT);
    available.setChecked(onlyStock);
    add(box, available);
    new AlertDialog.Builder(this)
        .setTitle("Фильтры каталога")
        .setView(box)
        .setPositiveButton(
            "Показать",
            (v, w) -> {
              category = ids.get(cats.getSelectedItemPosition());
              sort = sorts.get(sorting.getSelectedItemPosition());
              onlyStock = available.isChecked();
              render();
            })
        .setNeutralButton(
            "Сбросить",
            (v, w) -> {
              category = "";
              query = "";
              sort = "Популярные";
              onlyStock = false;
              render();
            })
        .setNegativeButton("Отмена", null)
        .show();
  }

  private void detail() {
    JSONObject p = store.product(productId);
    LinearLayout body = page();
    if (p == null) {
      heading(body, "", "Товар недоступен", "Возможно, его уже убрали из каталога.");
      return;
    }
    Ui.Art art = new Ui.Art(this, p.optString("categoryId"));
    body.addView(art, new LinearLayout.LayoutParams(-1, d(230)));
    gap(body, 20);
    heading(body, p.optString("brand"), p.optString("name"), p.optString("description"));
    section(body, availability(p));
    section(body, text(this, money(p.optLong("price")), 29, TEXT, true));
    Button buy =
        action(
            body,
            buyable(p)
                ? "Добавить в корзину"
                : !verified()
                    ? (verificationFailed ? "Наличие не проверено" : "Проверяем наличие…")
                    : "Нет в наличии",
            true,
            () -> addProduct(p));
    buy.setEnabled(buyable(p));
    buy.setAlpha(buyable(p) ? 1 : .45f);
    action(
        body,
        store.favorites.contains(productId) ? "♥  Убрать из избранного" : "♡  В избранное",
        false,
        () -> {
          store.favorite(productId);
          render();
        });
    action(
        body,
        store.compare.contains(productId) ? "Убрать из сравнения" : "Добавить к сравнению",
        false,
        () -> {
          if (!store.compare.remove(productId)) {
            if (store.compare.size() >= 4) {
              toast("Для сравнения можно выбрать до четырёх товаров");
              return;
            }
            store.compare.add(productId);
          }
          render();
        });
    section(body, text(this, "Характеристики", 21, TEXT, true));
    JSONObject specs = p.optJSONObject("specs");
    if (specs != null) {
      Iterator<String> keys = specs.keys();
      while (keys.hasNext()) {
        String key = keys.next();
        if (key.equals("score")) continue;
        summary(body, specName(key), specValue(specs.opt(key)));
      }
    }
    JSONArray reviews = store.array("reviews");
    for (int i = 0; i < reviews.length(); i++) {
      JSONObject review = reviews.optJSONObject(i);
      if (productId.equals(review.optString("productId"))
          && "published".equals(review.optString("status"))) {
        LinearLayout card = card(this);
        add(
            card,
            text(
                this,
                "★ "
                    + review.optInt("rating")
                    + " · "
                    + review.optString("author", review.optString("authorName", "Покупатель")),
                14,
                ACCENT,
                true));
        gap(card, 6);
        add(card, text(this, review.optString("text"), 14, TEXT, false));
        section(body, card);
      }
    }
  }

  private void summary(LinearLayout parent, String label, String value) {
    LinearLayout row = row(this);
    TextView left = text(this, label, 13, MUTED, false), right = text(this, value, 13, TEXT, true);
    right.setGravity(Gravity.END);
    row.addView(left, new LinearLayout.LayoutParams(0, -2, 1));
    row.addView(right, new LinearLayout.LayoutParams(0, -2, 1));
    section(parent, row);
  }

  private String specName(String key) {
    switch (key) {
      case "socket":
        return "Сокет";
      case "ramType":
      case "type":
        return "Тип";
      case "cores":
        return "Ядра";
      case "threads":
        return "Потоки";
      case "tdp":
        return "TDP, Вт";
      case "vram":
        return "Видеопамять, ГБ";
      case "wattage":
        return "Мощность, Вт";
      case "capacity":
        return "Объём";
      case "speed":
        return "Частота";
      case "formFactor":
        return "Форм-фактор";
      case "chipset":
        return "Чипсет";
      case "base":
        return "Базовая частота";
      case "boost":
        return "Турбочастота";
      case "wifi":
        return "Wi-Fi";
      case "read":
        return "Чтение, МБ/с";
      case "write":
        return "Запись, МБ/с";
      case "recommendedPsu":
        return "Рекомендуемый БП, Вт";
      case "length":
        return "Длина, мм";
      case "tdpRating":
        return "Отвод тепла, Вт";
      case "height":
        return "Высота, мм";
      case "sockets":
        return "Поддержка сокетов";
      case "ram":
        return "Оперативная память";
      case "storage":
        return "Накопитель";
      case "cpu":
        return "Процессор";
      case "gpu":
        return "Видеокарта";
      case "refresh":
        return "Частота, Гц";
      case "resolution":
        return "Разрешение";
      case "warranty":
        return "Гарантия";
      default:
        return key;
    }
  }

  private String specValue(Object value) {
    if (value instanceof Boolean) return (Boolean) value ? "Да" : "Нет";
    if (value instanceof JSONArray) {
      JSONArray a = (JSONArray) value;
      List<String> l = new ArrayList<>();
      for (int i = 0; i < a.length(); i++) l.add(a.optString(i));
      return TextUtils.join(", ", l);
    }
    return String.valueOf(value);
  }

  private void comparison() {
    LinearLayout body = column(this);
    body.setPadding(d(16), d(16), d(16), d(16));
    if (store.compare.isEmpty()) {
      add(
          body,
          text(
              this,
              "Откройте карточку товара и добавьте его к сравнению. Можно выбрать до четырёх"
                  + " товаров.",
              15,
              TEXT,
              false));
    } else
      for (String id : store.compare) {
        JSONObject p = store.product(id);
        if (p == null) continue;
        add(body, text(this, p.optString("name"), 17, ACCENT, true));
        add(body, text(this, money(p.optLong("price")), 18, TEXT, true));
        JSONObject specs = p.optJSONObject("specs");
        if (specs != null) {
          Iterator<String> keys = specs.keys();
          while (keys.hasNext()) {
            String key = keys.next();
            if (!key.equals("score")) summary(body, specName(key), specValue(specs.opt(key)));
          }
        }
        gap(body, 16);
      }
    ScrollView sc = new ScrollView(this);
    sc.addView(body);
    new AlertDialog.Builder(this)
        .setTitle("Сравнение товаров")
        .setView(sc)
        .setPositiveButton("Готово", null)
        .setNeutralButton(
            "Очистить",
            (v, w) -> {
              store.compare.clear();
              render();
            })
        .show();
  }

  private void cart() {
    LinearLayout body = page();
    if (store.cart.isEmpty()) {
      body.setGravity(Gravity.CENTER);
      Ui.EmptyCart icon = new Ui.EmptyCart(this);
      body.addView(icon, new LinearLayout.LayoutParams(d(190), d(180)));
      gap(body, 28);
      TextView empty = text(this, "В корзине пока ничего нет", 21, TEXT, true);
      empty.setGravity(Gravity.CENTER);
      section(body, empty);
      TextView sub =
          text(
              this,
              "Воспользуйтесь каталогом или поиском, чтобы найти нужные товары.",
              15,
              MUTED,
              false);
      sub.setGravity(Gravity.CENTER);
      section(body, sub);
      gap(body, 16);
      action(body, "Перейти в каталог", true, () -> tab(1));
      return;
    }
    for (Map.Entry<String, Integer> line : new LinkedHashMap<>(store.cart).entrySet()) {
      JSONObject p = store.product(line.getKey());
      LinearLayout card = card(this);
      String name = p == null ? "Товар больше недоступен" : p.optString("name");
      TextView product = text(this, name, 16, TEXT, true);
      add(card, product);
      if (p != null) product.setOnClickListener(v -> navigate("product", p.optString("id")));
      gap(card, 8);
      add(card, p == null ? text(this, "Удалён из каталога", 12, RED, false) : availability(p));
      gap(card, 8);
      LinearLayout controls = row(this);
      Button minus = button(this, "−", false), plus = button(this, "+", false);
      TextView qty = text(this, "  " + line.getValue() + "  ", 17, TEXT, true);
      controls.addView(minus, new LinearLayout.LayoutParams(d(42), d(42)));
      controls.addView(qty);
      controls.addView(plus, new LinearLayout.LayoutParams(d(42), d(42)));
      TextView price =
          text(this, p == null ? "" : money(p.optLong("price") * line.getValue()), 17, TEXT, true);
      price.setGravity(Gravity.END);
      controls.addView(price, new LinearLayout.LayoutParams(0, -2, 1));
      add(card, controls);
      minus.setContentDescription("Уменьшить количество " + name);
      plus.setContentDescription("Увеличить количество " + name);
      minus.setOnClickListener(
          v -> {
            store.quantity(line.getKey(), line.getValue() - 1);
            render();
          });
      plus.setEnabled(buyable(p) && line.getValue() < (p == null ? 0 : p.optInt("stock")));
      plus.setOnClickListener(
          v -> {
            store.quantity(line.getKey(), line.getValue() + 1);
            render();
          });
      gap(card, 8);
      Button remove = button(this, "Удалить", false);
      add(card, remove);
      remove.setOnClickListener(
          v -> {
            store.quantity(line.getKey(), 0);
            render();
          });
      section(body, card);
    }
    EditText code =
        field(
            this,
            "Промокод",
            android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
    code.setText(promo);
    section(body, code);
    action(
        body,
        "Применить промокод",
        false,
        () -> {
          String input = code.getText().toString().trim().toUpperCase(Locale.ROOT);
          if (!input.isEmpty()
              && (store.promo(input) == null
                  || store.subtotal() < store.promo(input).optLong("min"))) {
            toast("Промокод недействителен или не достигнута минимальная сумма");
            return;
          }
          promo = input;
          store.basketChanged();
          hideKeyboard();
          render();
        });
    summary(body, "Товары (" + store.count() + ")", money(store.subtotal()));
    if (store.discount(promo) > 0) summary(body, "Скидка", "−" + money(store.discount(promo)));
    summary(
        body, "Доставка", store.delivery(promo) == 0 ? "Бесплатно" : money(store.delivery(promo)));
    section(body, text(this, "Итого  " + money(store.total(promo)), 25, TEXT, true));
    Button checkout =
        action(
            body,
            verified() ? "Оформить заказ" : "Проверяем наличие…",
            true,
            () -> {
              for (Map.Entry<String, Integer> e : store.cart.entrySet()) {
                JSONObject p = store.product(e.getKey());
                if (!buyable(p) || e.getValue() > p.optInt("stock")) {
                  toast("Обновите корзину: часть товаров недоступна в выбранном количестве");
                  return;
                }
              }
              if (store.session == null) {
                navigate("login", null);
                return;
              }
              navigate("checkout", null);
            });
    checkout.setEnabled(verified());
    checkout.setAlpha(verified() ? 1 : .45f);
  }

  private EditText formField(LinearLayout parent, String label, String value, int type) {
    add(parent, text(this, label, 12, MUTED, true));
    gap(parent, 6);
    EditText e = field(this, label, type);
    e.setText(value);
    e.setContentDescription(label);
    section(parent, e);
    return e;
  }

  private void profile() {
    LinearLayout body = page();
    body.setPadding(d(16), d(16), d(16), d(24));
    LinearLayout account = card(this);
    if (store.session == null) {
      section(account, text(this, "Сохраняйте покупки и следите за заказами", 16, TEXT, true));
      action(account, "Войти", true, () -> navigate("login", null));
      TextView signup = text(this, "Создать аккаунт", 13, ACCENT, true);
      signup.setGravity(Gravity.CENTER);
      add(account, signup);
      signup.setOnClickListener(v -> navigate("register", null));
    } else {
      JSONObject user = store.profile();
      add(account, text(this, user.optString("name", "Покупатель"), 19, TEXT, true));
      gap(account, 6);
      add(account, text(this, user.optString("email"), 13, MUTED, false));
      gap(account, 12);
      action(account, "Личные данные", false, () -> navigate("edit_profile", null));
    }
    section(body, account);
    LinearLayout city = menuGroup(body);
    menuRow(city, 8, store.city(), this::chooseCity);
    LinearLayout shopping = menuGroup(body);
    menuRow(
        shopping,
        5,
        "Мои заказы",
        () -> navigate(store.session == null ? "login" : "orders", null));
    menuRow(shopping, 2, "Избранное", () -> tab(2));
    menuRow(shopping, 13, "Сравнение", this::comparison);
    menuRow(shopping, 12, "Обратная связь", this::contact);
    LinearLayout help = menuGroup(body);
    menuRow(
        help,
        10,
        "Помощь",
        () ->
            new AlertDialog.Builder(this)
                .setTitle("Помощь")
                .setMessage(
                    "Добавьте товары в корзину и войдите в аккаунт для оформления заказа. Стоимость"
                        + " доставки и итоговая сумма показаны в корзине.\n\n"
                        + "Наличие и цены обновляются автоматически. Статус ваших заказов доступен"
                        + " в профиле.\n\n"
                        + "После регистрации подтвердите адрес по ссылке из письма и войдите в"
                        + " приложение.")
                .setPositiveButton("Понятно", null)
                .show());
    menuRow(
        help,
        11,
        "О приложении",
        () ->
            new AlertDialog.Builder(this)
                .setTitle("ByteStore")
                .setMessage(
                    "Магазин комплектующих и готовых ПК.\n\nВерсия " + BuildConfig.VERSION_NAME)
                .setPositiveButton("Готово", null)
                .show());
    menuRow(help, 9, "Настройки", this::settings);
    if (store.session != null) {
      LinearLayout logout = menuGroup(body);
      menuRow(logout, 14, "Выйти из аккаунта", this::logout);
    }
  }

  private LinearLayout menuGroup(LinearLayout parent) {
    LinearLayout group = column(this);
    group.setBackground(background(this, SURFACE, 15));
    section(parent, group);
    return group;
  }

  private void menuRow(LinearLayout group, int type, String label, Runnable run) {
    if (group.getChildCount() > 0) {
      View line = new View(this);
      line.setBackgroundColor(BORDER);
      LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, d(1));
      lp.leftMargin = d(16);
      lp.rightMargin = d(16);
      group.addView(line, lp);
    }
    LinearLayout row = row(this);
    row.setPadding(d(16), d(17), d(16), d(17));
    row.setMinimumHeight(d(62));
    Ui.NavIcon icon = new Ui.NavIcon(this, type);
    row.addView(icon, new LinearLayout.LayoutParams(d(24), d(24)));
    TextView name = text(this, label, 15, TEXT, false);
    LinearLayout.LayoutParams textLayout = new LinearLayout.LayoutParams(0, -2, 1);
    textLayout.leftMargin = d(14);
    textLayout.rightMargin = d(12);
    row.addView(name, textLayout);
    row.addView(text(this, "›", 23, MUTED, false));
    add(group, row);
    row.setContentDescription(label);
    row.setOnClickListener(v -> run.run());
  }

  private void chooseTheme() {
    String[] values = {"light", "dark", "system"};
    String current = getSharedPreferences("appearance", MODE_PRIVATE).getString("theme", "light");
    int selected = Arrays.asList(values).indexOf(current);
    new AlertDialog.Builder(this)
        .setTitle("Тема оформления")
        .setSingleChoiceItems(
            new String[] {"Светлая", "Тёмная", "Как на устройстве"},
            selected,
            (dialog, position) -> {
              getSharedPreferences("appearance", MODE_PRIVATE)
                  .edit()
                  .putString("theme", values[position])
                  .apply();
              dialog.dismiss();
              recreate();
            })
        .setNegativeButton("Отмена", null)
        .show();
  }

  private void settings() {
    new AlertDialog.Builder(this)
        .setTitle("Настройки")
        .setItems(
            new String[] {
              "Тема оформления", "Город доставки", "Обновить цены и наличие", "Настройки Android"
            },
            (dialog, pos) -> {
              if (pos == 0) chooseTheme();
              else if (pos == 1) chooseCity();
              else if (pos == 2) {
                refresh();
                toast("Обновляем каталог");
              } else
                startActivity(
                    new Intent(
                        android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + getPackageName())));
            })
        .setNegativeButton("Закрыть", null)
        .show();
  }

  private void contact() {
    new AlertDialog.Builder(this)
        .setTitle("Связаться с ByteStore")
        .setItems(
            new String[] {"Позвонить: +7 (727) 355-31-08", "Написать: support@bytestore.kz"},
            (dialog, pos) -> {
              try {
                startActivity(
                    pos == 0
                        ? new Intent(Intent.ACTION_DIAL, Uri.parse("tel:+77273553108"))
                        : new Intent(
                            Intent.ACTION_SENDTO, Uri.parse("mailto:support@bytestore.kz")));
              } catch (ActivityNotFoundException e) {
                toast("Не найдено приложение для этого действия");
              }
            })
        .setNegativeButton("Закрыть", null)
        .show();
  }

  private void logout() {
    new AlertDialog.Builder(this)
        .setTitle("Выйти из аккаунта?")
        .setPositiveButton(
            "Выйти",
            (a, b) ->
                async(
                    () -> {
                      try {
                        api.request("/auth/v1/logout", new JSONObject(), true);
                      } catch (Exception ignored) {
                      }
                      store.saveSession(null);
                      return true;
                    },
                    ok -> {
                      store.changeOwner(false);
                      store.state.remove("users");
                      store.state.remove("orders");
                      verifiedAt = 0;
                      tab(4);
                      refresh();
                    }))
        .setNegativeButton("Отмена", null)
        .show();
  }

  private void editProfile() {
    if (store.session == null) {
      screen = "login";
      render();
      return;
    }
    JSONObject user = store.profile();
    LinearLayout body = page();
    EditText
        name =
            formField(
                body,
                "Имя и фамилия",
                user.optString("name"),
                android.text.InputType.TYPE_CLASS_TEXT
                    | android.text.InputType.TYPE_TEXT_FLAG_CAP_WORDS),
        phone =
            formField(
                body, "Телефон", user.optString("phone"), android.text.InputType.TYPE_CLASS_PHONE);
    summary(body, "E-mail", user.optString("email"));
    action(
        body,
        "Сохранить",
        true,
        () -> {
          if (name.getText().toString().trim().length() < 2
              || digits(phone.getText().toString()).length() < 10) {
            toast("Укажите имя и корректный телефон");
            return;
          }
          JSONObject patch =
              Store.obj(
                  "name",
                  name.getText().toString().trim(),
                  "phone",
                  phone.getText().toString().trim(),
                  "email",
                  user.optString("email"));
          command(
              "updateProfile",
              new JSONArray().put(patch),
              () -> {
                toast("Профиль сохранён");
                render();
              });
        });
    action(body, "Восстановить пароль", false, () -> navigate("reset", null));
  }

  private String digits(String s) {
    return s.replaceAll("\\D", "");
  }

  private void login(boolean registration) {
    LinearLayout body = page();
    heading(
        body,
        "Безопасный вход",
        registration ? "Создать аккаунт" : "Вход",
        registration
            ? "Подтвердите e-mail по ссылке из письма, затем войдите в приложение."
            : "Войдите в аккаунт ByteStore.");
    EditText name =
        registration
            ? formField(
                body,
                "Имя и фамилия",
                "",
                android.text.InputType.TYPE_CLASS_TEXT
                    | android.text.InputType.TYPE_TEXT_FLAG_CAP_WORDS)
            : null;
    EditText email =
        formField(
            body,
            "E-mail",
            "",
            android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
    EditText phone =
        registration
            ? formField(body, "Телефон", "+7", android.text.InputType.TYPE_CLASS_PHONE)
            : null;
    EditText password =
        formField(
            body,
            "Пароль",
            "",
            android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
    password.setTransformationMethod(PasswordTransformationMethod.getInstance());
    EditText repeat =
        registration
            ? formField(
                body,
                "Повторите пароль",
                "",
                android.text.InputType.TYPE_CLASS_TEXT
                    | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD)
            : null;
    if (repeat != null) repeat.setTransformationMethod(PasswordTransformationMethod.getInstance());
    CheckBox agree = new CheckBox(this);
    if (registration) {
      agree.setText("Принимаю условия использования и политику конфиденциальности");
      agree.setTextColor(MUTED);
      section(body, agree);
      action(
          body,
          "Условия и конфиденциальность",
          false,
          () ->
              new AlertDialog.Builder(this)
                  .setTitle("ByteStore")
                  .setMessage(
                      "Имя, телефон и адрес используются для обработки и доставки ваших заказов."
                          + " Данные аккаунта хранятся в общей базе ByteStore. Вы можете изменить"
                          + " профиль и выйти из аккаунта в приложении.")
                  .setPositiveButton("Понятно", null)
                  .show());
    }
    Button submit = action(body, registration ? "Зарегистрироваться" : "Войти", true, () -> {});
    submit.setOnClickListener(
        v -> {
          String address = email.getText().toString().trim().toLowerCase(Locale.ROOT),
              pass = password.getText().toString();
          if (!android.util.Patterns.EMAIL_ADDRESS.matcher(address).matches()) {
            email.setError("Укажите корректный e-mail");
            return;
          }
          if (pass.length() < 8) {
            password.setError("Минимум 8 символов");
            return;
          }
          if (registration
              && (name.getText().toString().trim().length() < 2
                  || digits(phone.getText().toString()).length() < 10
                  || !pass.equals(repeat.getText().toString())
                  || !agree.isChecked())) {
            toast("Проверьте имя, телефон, повтор пароля и согласие с условиями");
            return;
          }
          String accountName = registration ? name.getText().toString().trim() : "",
              accountPhone = registration ? phone.getText().toString().trim() : "";
          hideKeyboard();
          submit.setEnabled(false);
          worker.execute(
              () -> {
                try {
                  JSONObject result;
                  if (registration)
                    result =
                        api.request(
                            "/auth/v1/signup?redirect_to=https%3A%2F%2Fstereofox08.github.io%2FDiplom%2Flogin.html",
                            Store.obj(
                                "email",
                                address,
                                "password",
                                pass,
                                "data",
                                Store.obj("name", accountName, "phone", accountPhone)),
                            false);
                  else
                    result =
                        api.request(
                            "/auth/v1/token?grant_type=password",
                            Store.obj("email", address, "password", pass),
                            false);
                  if (result.has("access_token")) {
                    api.setSession(result);
                    JSONObject snapshot = api.snapshot();
                    store.cachePublic(snapshot);
                    main.post(
                        () -> {
                          store.applySnapshot(snapshot);
                          store.changeOwner(true);
                          verifiedAt = SystemClock.elapsedRealtime();
                          password.setText("");
                          tab(4);
                          toast("Вход выполнен");
                        });
                  } else
                    main.post(
                        () -> {
                          password.setText("");
                          screen = "login";
                          render();
                          new AlertDialog.Builder(this)
                              .setTitle("Проверьте почту")
                              .setMessage(
                                  "Подтвердите e-mail по ссылке из письма. После подтверждения"
                                      + " вернитесь в приложение и войдите с вашим паролем.")
                              .setPositiveButton("Понятно", null)
                              .show();
                        });
                } catch (Exception e) {
                  main.post(
                      () -> {
                        submit.setEnabled(true);
                        toast(e.getMessage());
                      });
                }
              });
        });
    action(
        body,
        registration ? "Уже есть аккаунт? Войти" : "Создать аккаунт",
        false,
        () -> {
          screen = registration ? "login" : "register";
          render();
        });
    if (!registration) action(body, "Забыли пароль?", false, () -> navigate("reset", null));
  }

  private void resetPassword() {
    LinearLayout body = page();
    heading(
        body,
        "Доступ к аккаунту",
        "Восстановить пароль",
        "Письмо откроет страницу восстановления в браузере. После смены пароля вернитесь в"
            + " приложение.");
    EditText email =
        formField(
            body,
            "E-mail",
            store.profile().optString("email"),
            android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
    action(
        body,
        "Отправить письмо",
        true,
        () -> {
          String address = email.getText().toString().trim();
          if (!android.util.Patterns.EMAIL_ADDRESS.matcher(address).matches()) {
            email.setError("Проверьте e-mail");
            return;
          }
          async(
              () ->
                  api.request(
                      "/auth/v1/recover?redirect_to=https%3A%2F%2Fstereofox08.github.io%2FDiplom%2Flogin.html",
                      Store.obj("email", address), false),
              result -> toast("Если аккаунт существует, письмо отправлено. Проверьте почту."));
        });
  }

  private void command(String op, JSONArray args, Runnable success) {
    async(
        () -> {
          api.request("/rest/v1/rpc/store_command", Store.obj("op", op, "args", args), true);
          JSONObject snapshot = api.snapshot();
          store.cachePublic(snapshot);
          return snapshot;
        },
        snapshot -> {
          store.applySnapshot(snapshot);
          verifiedAt = SystemClock.elapsedRealtime();
          success.run();
        });
  }

  private void orders() {
    LinearLayout body = page();
    heading(body, "Личный кабинет", "Мои заказы", "");
    if (store.session == null) {
      action(body, "Войти", true, () -> navigate("login", null));
      return;
    }
    JSONArray orders = store.array("orders");
    int count = 0;
    for (int i = 0; i < orders.length(); i++) {
      JSONObject order = orders.optJSONObject(i);
      if (!store.owner.equals(order.optString("userId"))) continue;
      count++;
      LinearLayout card = card(this);
      add(card, text(this, order.optString("number", "Заказ"), 19, TEXT, true));
      gap(card, 8);
      String status = order.optString("status");
      summary(card, "Статус", orderStatus(status));
      summary(card, "Оплата", order.optString("payment"));
      summary(card, "Итого", money(order.optLong("total")));
      JSONArray lines = order.optJSONArray("items");
      if (lines != null)
        for (int j = 0; j < lines.length(); j++) {
          JSONObject line = lines.optJSONObject(j);
          add(
              card,
              text(this, line.optString("name") + " × " + line.optInt("qty"), 13, MUTED, false));
          gap(card, 6);
        }
      if (status.equals("shipped"))
        action(
            card,
            "Подтвердить получение",
            false,
            () ->
                command(
                    "setOrderStatus",
                    new JSONArray()
                        .put(order.optString("id"))
                        .put("delivered")
                        .put("Получено покупателем"),
                    this::render));
      section(body, card);
    }
    if (count == 0)
      section(
          body,
          text(
              this,
              "Заказов пока нет. Выберите товары в каталоге — история появится здесь.",
              16,
              MUTED,
              false));
    action(body, "Обновить заказы", false, this::refresh);
  }

  private String orderStatus(String value) {
    switch (value) {
      case "new":
        return "Новый";
      case "processing":
        return "В обработке";
      case "shipped":
        return "В пути";
      case "delivered":
        return "Получен";
      case "cancelled":
        return "Отменён";
      default:
        return value;
    }
  }

  private boolean placingOrder = false;
  private Button orderButton;
  private long checkoutQuote;

  private void checkout() {
    if (store.session == null) {
      screen = "login";
      render();
      return;
    }
    if (store.cart.isEmpty()) {
      screen = "cart";
      render();
      return;
    }
    JSONObject user = store.profile();
    LinearLayout body = page();
    heading(body, "Доставка и оплата", "Оформление заказа", "");
    EditText name =
        formField(
            body,
            "Имя и фамилия",
            user.optString("name"),
            android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_FLAG_CAP_WORDS);
    EditText phone =
        formField(
            body, "Телефон", user.optString("phone"), android.text.InputType.TYPE_CLASS_PHONE);
    EditText email =
        formField(
            body,
            "E-mail",
            user.optString("email"),
            android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
    Spinner city =
        spinner(
            body,
            "Город",
            Arrays.asList(
                store.city(),
                "Алматы",
                "Астана",
                "Петропавловск",
                "Шымкент",
                "Караганда",
                "Актобе",
                "Тараз",
                "Павлодар"),
            0);
    Spinner delivery =
        spinner(
            body,
            "Доставка",
            Arrays.asList(
                "Курьер до двери",
                "Самовывоз из пункта выдачи",
                "Экспресс-доставка (в день заказа)"),
            0);
    EditText address =
        formField(body, "Адрес доставки", "", android.text.InputType.TYPE_CLASS_TEXT);
    Spinner payment =
        spinner(
            body,
            "Способ оплаты",
            Arrays.asList("Картой онлайн", "Единый QR", "Рассрочка", "При получении"),
            0);
    LinearLayout installment = column(this);
    Spinner term =
        spinner(installment, "Срок рассрочки", Arrays.asList("0-0-6", "0-0-12", "0-0-24"), 0);
    Spinner bank =
        spinner(installment, "Банк", Arrays.asList("Halyk", "Kaspi", "BCC", "Freedom"), 0);
    add(body, installment);
    installment.setVisibility(View.GONE);
    payment.setOnItemSelectedListener(
        new android.widget.AdapterView.OnItemSelectedListener() {
          public void onItemSelected(AdapterView<?> parent, View view, int pos, long id) {
            installment.setVisibility(pos == 2 ? View.VISIBLE : View.GONE);
          }

          public void onNothingSelected(AdapterView<?> parent) {}
        });
    EditText comment =
        formField(body, "Комментарий к заказу", "", android.text.InputType.TYPE_CLASS_TEXT);
    summary(body, "Товары", money(store.subtotal()));
    if (store.discount(promo) > 0) summary(body, "Скидка", "−" + money(store.discount(promo)));
    summary(
        body, "Доставка", store.delivery(promo) == 0 ? "Бесплатно" : money(store.delivery(promo)));
    checkoutQuote = store.total(promo);
    TextView quoteLabel = text(this, "Итого  " + money(checkoutQuote), 24, TEXT, true);
    section(body, quoteLabel);
    orderButton = action(body, "Продолжить · " + money(store.total(promo)), true, () -> {});
    orderButton.setOnClickListener(
        v -> {
          if (placingOrder) return;
          if (!verified()) {
            toast("Проверяем актуальные цены и наличие. Нажмите продолжить после обновления.");
            refresh();
            return;
          }
          if (name.getText().toString().trim().length() < 2) {
            name.setError("Укажите имя и фамилию");
            return;
          }
          if (digits(phone.getText().toString()).length() < 10) {
            phone.setError("Проверьте телефон");
            return;
          }
          if (!android.util.Patterns.EMAIL_ADDRESS
              .matcher(email.getText().toString().trim())
              .matches()) {
            email.setError("Проверьте e-mail");
            return;
          }
          if (address.getText().toString().trim().isEmpty()) {
            address.setError("Укажите адрес или пункт выдачи");
            return;
          }
          hideKeyboard();
          if (checkoutQuote != store.total(promo)) {
            checkoutQuote = store.total(promo);
            quoteLabel.setText("Итого  " + money(checkoutQuote));
            orderButton.setText("Продолжить · " + money(checkoutQuote));
            new AlertDialog.Builder(this)
                .setTitle("Стоимость обновилась")
                .setMessage("Проверьте новую сумму заказа: " + money(checkoutQuote))
                .setPositiveButton("Понятно", null)
                .show();
            return;
          }
          String method = payment.getSelectedItem().toString();
          if (method.equals("Рассрочка"))
            method = "Рассрочка " + term.getSelectedItem() + " · " + bank.getSelectedItem();
          JSONObject payload =
              Store.obj(
                  "requestId",
                  store.checkoutId(),
                  "customer",
                  Store.obj(
                      "name",
                      name.getText().toString().trim(),
                      "phone",
                      phone.getText().toString().trim(),
                      "email",
                      email.getText().toString().trim()),
                  "city",
                  city.getSelectedItem(),
                  "address",
                  address.getText().toString().trim(),
                  "deliveryType",
                  delivery.getSelectedItem(),
                  "payment",
                  method,
                  "comment",
                  comment.getText().toString().trim(),
                  "promoCode",
                  promo,
                  "lines",
                  store.lines(),
                  "expectedTotal",
                  store.total(promo));
          if (method.equals("Картой онлайн")) cardPayment(payload);
          else if (method.equals("Единый QR")) qrPayment(payload);
          else
            new AlertDialog.Builder(this)
                .setTitle(
                    method.startsWith("Рассрочка")
                        ? "Подтверждение рассрочки"
                        : "Подтверждение заказа")
                .setMessage(method + "\n\nК оплате: " + money(store.total(promo)))
                .setPositiveButton("Подтвердить", (a, b) -> submitOrder(payload))
                .setNegativeButton("Отмена", null)
                .show();
        });
  }

  private void cardPayment(JSONObject payload) {
    LinearLayout box = column(this);
    box.setPadding(d(20), d(12), d(20), d(12));
    EditText number = formField(box, "Номер карты", "", android.text.InputType.TYPE_CLASS_NUMBER);
    number.setFilters(new InputFilter[] {new InputFilter.LengthFilter(19)});
    EditText holder =
        formField(
            box,
            "Имя на карте",
            "",
            android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
    EditText expiry =
        formField(box, "Срок действия ММ/ГГ", "", android.text.InputType.TYPE_CLASS_DATETIME);
    EditText cvv =
        formField(
            box,
            "CVV",
            "",
            android.text.InputType.TYPE_CLASS_NUMBER
                | android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD);
    cvv.setTransformationMethod(PasswordTransformationMethod.getInstance());
    cvv.setFilters(new InputFilter[] {new InputFilter.LengthFilter(4)});
    ScrollView scroll = new ScrollView(this);
    scroll.addView(box);
    AlertDialog dialog =
        new AlertDialog.Builder(this)
            .setTitle("Оплата · " + money(payload.optLong("expectedTotal")))
            .setView(scroll)
            .setPositiveButton("Оплатить", null)
            .setNegativeButton("Отмена", null)
            .create();
    dialog.setOnShowListener(
        x ->
            dialog
                .getButton(AlertDialog.BUTTON_POSITIVE)
                .setOnClickListener(
                    v -> {
                      String card = digits(number.getText().toString());
                      if (!Payment.validCard(card)) {
                        number.setError("Проверьте номер карты");
                        return;
                      }
                      if (holder.getText().toString().trim().length() < 2) {
                        holder.setError("Укажите имя на карте");
                        return;
                      }
                      if (!Payment.validExpiry(expiry.getText().toString())) {
                        expiry.setError("Укажите действующий срок ММ/ГГ");
                        return;
                      }
                      if (!cvv.getText().toString().matches("\\d{3,4}")) {
                        cvv.setError("Проверьте CVV");
                        return;
                      }
                      number.setText("");
                      cvv.setText("");
                      holder.setText("");
                      expiry.setText("");
                      dialog.dismiss();
                      hideKeyboard();
                      submitOrder(payload);
                    }));
    dialog.show();
  }

  private void qrPayment(JSONObject payload) {
    LinearLayout box = column(this);
    box.setGravity(Gravity.CENTER);
    box.setPadding(d(20), d(16), d(20), d(16));
    try {
      com.google.zxing.common.BitMatrix matrix =
          new com.google.zxing.qrcode.QRCodeWriter()
              .encode(
                  "BYTESTORE|"
                      + payload.optString("requestId")
                      + "|"
                      + payload.optLong("expectedTotal"),
                  com.google.zxing.BarcodeFormat.QR_CODE,
                  480,
                  480);
      android.graphics.Bitmap bitmap =
          android.graphics.Bitmap.createBitmap(480, 480, android.graphics.Bitmap.Config.ARGB_8888);
      for (int y = 0; y < 480; y++)
        for (int x = 0; x < 480; x++)
          bitmap.setPixel(
              x, y, matrix.get(x, y) ? android.graphics.Color.BLACK : android.graphics.Color.WHITE);
      ImageView image = new ImageView(this);
      image.setImageBitmap(bitmap);
      box.addView(image, new LinearLayout.LayoutParams(d(220), d(220)));
      gap(box, 12);
      add(box, text(this, money(payload.optLong("expectedTotal")), 23, TEXT, true));
      new AlertDialog.Builder(this)
          .setTitle("Единый QR")
          .setView(box)
          .setPositiveButton("Подтвердить оплату", (a, b) -> submitOrder(payload))
          .setNegativeButton("Отмена", null)
          .show();
    } catch (Exception e) {
      toast("Не удалось подготовить QR-код");
    }
  }

  private void submitOrder(JSONObject payload) {
    if (placingOrder) return;
    placingOrder = true;
    if (orderButton != null) orderButton.setEnabled(false);
    pending++;
    setStatus();
    worker.execute(
        () -> {
          try {
            JSONObject result =
                api.request("/rest/v1/rpc/checkout", Store.obj("payload", payload), true);
            JSONObject snapshot = null;
            try {
              snapshot = api.snapshot();
              store.cachePublic(snapshot);
            } catch (Exception ignored) {
            }
            final JSONObject updated = snapshot;
            main.post(
                () -> {
                  if (isDestroyed()) return;
                  pending--;
                  placingOrder = false;
                  if (updated != null) {
                    store.applySnapshot(updated);
                    verifiedAt = SystemClock.elapsedRealtime();
                  } else verifiedAt = 0;
                  store.clearCart();
                  promo = "";
                  screen = "orders";
                  selected = 4;
                  history.clear();
                  render();
                  new AlertDialog.Builder(this)
                      .setTitle("Заказ оформлен")
                      .setMessage(
                          "Спасибо за покупку! Следить за статусом можно в разделе «Мои заказы».")
                      .setPositiveButton("Готово", null)
                      .show();
                  if (updated == null) refresh();
                });
          } catch (Exception e) {
            main.post(
                () -> {
                  if (isDestroyed()) return;
                  pending--;
                  placingOrder = false;
                  if (orderButton != null) orderButton.setEnabled(true);
                  setStatus();
                  new AlertDialog.Builder(this)
                      .setTitle("Заказ не подтверждён")
                      .setMessage(e.getMessage())
                      .setPositiveButton(
                          "Обновить корзину",
                          (a, b) -> {
                            screen = "cart";
                            render();
                            refresh();
                          })
                      .setNegativeButton("Закрыть", null)
                      .show();
                });
          }
        });
  }

  private Map<String, JSONObject> manualBuild() {
    Map<String, JSONObject> build = new LinkedHashMap<>();
    try {
      JSONObject ids =
          new JSONObject(getSharedPreferences("builder", MODE_PRIVATE).getString("draft", "{}"));
      for (String slot : BuildRules.SLOTS) {
        JSONObject p = store.product(ids.optString(slot));
        if (p != null) build.put(slot, p);
      }
    } catch (Exception ignored) {
    }
    return build;
  }

  private void saveBuild(Map<String, JSONObject> build) {
    JSONObject ids = new JSONObject();
    try {
      for (String slot : build.keySet()) ids.put(slot, build.get(slot).optString("id"));
    } catch (Exception ignored) {
    }
    getSharedPreferences("builder", MODE_PRIVATE).edit().putString("draft", ids.toString()).apply();
  }

  private void builder() {
    LinearLayout body = page();
    heading(
        body,
        "Конфигуратор",
        "Соберите свой ПК",
        "Выберите детали. Совместимость и стоимость пересчитываются автоматически.");
    action(body, "Автоматический подбор по бюджету", false, this::autoBuilder);
    Map<String, JSONObject> build = manualBuild();
    for (int i = 0; i < BuildRules.SLOTS.length; i++) {
      final String slot = BuildRules.SLOTS[i], label = BuildRules.LABELS[i];
      if (i == 8) section(body, text(this, "Дополнительные устройства", 21, TEXT, true));
      JSONObject p = build.get(slot);
      LinearLayout item = card(this);
      add(
          item,
          text(
              this,
              String.format(java.util.Locale.ROOT, "%02d  %s", i + 1, label),
              13,
              ACCENT,
              true));
      gap(item, 10);
      add(
          item,
          text(
              this,
              p == null ? "Не выбрано" : p.optString("name"),
              16,
              p == null ? MUTED : TEXT,
              true));
      if (p != null) {
        gap(item, 6);
        add(item, text(this, money(p.optLong("price")), 18, TEXT, true));
        if (!buyable(p))
          add(item, text(this, "Наличие требует проверки или товар недоступен", 12, RED, false));
      }
      action(item, p == null ? "Выбрать" : "Заменить", false, () -> buildPicker(slot, label));
      if (p != null)
        action(
            item,
            "Убрать",
            false,
            () -> {
              build.remove(slot);
              saveBuild(build);
              builder();
            });
      section(body, item);
    }
    BuildRules.Check check = BuildRules.check(build);
    LinearLayout total = card(this);
    add(total, text(this, "Ваша сборка", 22, TEXT, true));
    gap(total, 12);
    add(total, text(this, money(check.total), 28, ACCENT, true));
    add(
        total,
        text(
            this,
            "Пиковое потребление: "
                + check.peak
                + " Вт\nРекомендуемый БП: от "
                + check.recommended
                + " Вт",
            14,
            MUTED,
            false));
    if (!build.isEmpty()) {
      add(total, text(this, "Оценка: ≈ " + check.fps + " FPS в Full HD", 14, TEXT, true));
      if (check.ok())
        add(total, text(this, "Совместимость выбранных деталей подтверждена", 14, GREEN, true));
      for (String msg : check.errors) add(total, text(this, "• " + msg, 14, RED, false));
      for (String msg : check.warnings) add(total, text(this, "• " + msg, 14, MUTED, false));
      for (String msg : check.notes) add(total, text(this, "• " + msg, 13, MUTED, false));
      boolean complete = true;
      for (String slot : new String[] {"cpu", "motherboard", "ram", "storage", "psu", "case"})
        if (!build.containsKey(slot)) complete = false;
      if (!complete)
        add(
            total,
            text(
                this,
                "Сборка неполная. Можно добавить выбранные детали или заполнить оставшиеся слоты.",
                13,
                MUTED,
                false));
    }
    Button buy =
        action(
            total,
            "Добавить сборку в корзину",
            true,
            () -> {
              Map<String, JSONObject> fresh = manualBuild();
              if (!verified()) {
                toast("Сначала проверим наличие деталей");
                refresh();
                return;
              }
              if (!BuildRules.check(fresh).ok()) {
                toast("Исправьте несовместимость деталей");
                builder();
                return;
              }
              for (JSONObject p : fresh.values())
                if (!buyable(p)
                    || store.cart.getOrDefault(p.optString("id"), 0) >= p.optInt("stock")) {
                  toast("Одна из деталей недоступна в нужном количестве");
                  builder();
                  return;
                }
              for (JSONObject p : fresh.values()) store.add(p.optString("id"));
              badges();
              toast("Сборка добавлена в корзину");
            });
    int savedCount = 0;
    try {
      savedCount =
          new JSONObject(getSharedPreferences("builder", MODE_PRIVATE).getString("draft", "{}"))
              .length();
    } catch (Exception ignored) {
    }
    boolean missing = savedCount > build.size();
    if (missing)
      add(
          total,
          text(
              this,
              "Один из сохранённых товаров удалён из каталога. Выберите замену или очистите"
                  + " сборку.",
              14,
              RED,
              false));
    buy.setEnabled(!build.isEmpty() && check.ok() && !missing);
    action(
            total,
            "Поделиться спецификацией",
            false,
            () -> {
              StringBuilder spec = new StringBuilder("Сборка ByteStore\n\n");
              for (int i = 0; i < BuildRules.SLOTS.length; i++) {
                JSONObject p = build.get(BuildRules.SLOTS[i]);
                if (p != null)
                  spec.append(BuildRules.LABELS[i])
                      .append(": ")
                      .append(p.optString("name"))
                      .append(" — ")
                      .append(money(p.optLong("price")))
                      .append("\n");
              }
              spec.append("\nИтого: ").append(money(check.total));
              Intent share =
                  new Intent(Intent.ACTION_SEND)
                      .setType("text/plain")
                      .putExtra(Intent.EXTRA_TEXT, spec.toString());
              startActivity(Intent.createChooser(share, "Спецификация сборки"));
            })
        .setEnabled(!build.isEmpty());
    action(
        total,
        "Очистить сборку",
        false,
        () ->
            new AlertDialog.Builder(this)
                .setTitle("Очистить сборку?")
                .setMessage("Все выбранные детали будут удалены из конфигуратора.")
                .setNegativeButton("Отмена", null)
                .setPositiveButton(
                    "Очистить",
                    (d, w) -> {
                      saveBuild(new LinkedHashMap<>());
                      builder();
                    })
                .show());
    section(body, total);
  }

  private void buildPicker(String slot, String label) {
    LinearLayout box = column(this);
    box.setPadding(dp(this, 16), 0, dp(this, 16), 0);
    EditText search = field(this, "Поиск по названию", android.text.InputType.TYPE_CLASS_TEXT);
    add(box, search);
    CheckBox compatible = new CheckBox(this);
    compatible.setText("Только совместимые с выбранными");
    compatible.setTextColor(TEXT);
    compatible.setTypeface(font(this, 500));
    compatible.setTextSize(13);
    add(box, compatible);
    Spinner order =
        spinner(
            box,
            "Сортировка",
            Arrays.asList("Сначала дешевле", "Сначала дороже", "По популярности"),
            0);
    ListView list = new ListView(this);
    box.addView(
        list,
        new LinearLayout.LayoutParams(
            -1,
            dp(
                this,
                Math.max(
                    180,
                    Math.min(
                        320,
                        getResources().getDisplayMetrics().heightPixels
                                / getResources().getDisplayMetrics().density
                            - 340)))));
    List<JSONObject> visible = new ArrayList<>();
    ArrayAdapter<String> rows =
        new ArrayAdapter<String>(this, android.R.layout.simple_list_item_1, new ArrayList<>()) {
          @Override
          public View getView(int position, View reused, ViewGroup parent) {
            TextView row = (TextView) super.getView(position, reused, parent);
            row.setTypeface(font(MainActivity.this, 500));
            row.setTextSize(14);
            row.setTextColor(TEXT);
            row.setPadding(
                dp(MainActivity.this, 12),
                dp(MainActivity.this, 12),
                dp(MainActivity.this, 12),
                dp(MainActivity.this, 12));
            return row;
          }
        };
    list.setAdapter(rows);
    AlertDialog dialog =
        new AlertDialog.Builder(this)
            .setTitle(label)
            .setView(box)
            .setNegativeButton("Закрыть", null)
            .create();
    Runnable update =
        () -> {
          visible.clear();
          rows.clear();
          Map<String, JSONObject> current = manualBuild();
          for (int i = 0; i < store.array("products").length(); i++) {
            JSONObject p = store.array("products").optJSONObject(i);
            if (p == null
                || !p.optString("categoryId").equals(BuildRules.category(slot))
                || p.optInt("stock") <= 0
                || !p.optString("status", "active").equals("active")) continue;
            if (BuildRules.category(slot).equals("peripherals")
                && !BuildRules.specs(p).optString("kind").equals(slot)) continue;
            if (!p.optString("name")
                .toLowerCase(java.util.Locale.ROOT)
                .contains(search.getText().toString().toLowerCase(java.util.Locale.ROOT))) continue;
            Map<String, JSONObject> trial = new LinkedHashMap<>(current);
            trial.put(slot, p);
            // A CPU without a GPU is a valid intermediate choice. Other errors remain visible.
            BuildRules.Check after = BuildRules.check(trial);
            List<String> introduced = new ArrayList<>(after.errors);

            introduced.remove("У процессора нет встроенной графики — нужна видеокарта");
            if (compatible.isChecked() && !introduced.isEmpty()) continue;
            visible.add(p);
          }
          visible.sort(
              (a, b) ->
                  order.getSelectedItemPosition() == 2
                      ? Double.compare(b.optDouble("rating", 0), a.optDouble("rating", 0))
                      : order.getSelectedItemPosition() == 1
                          ? Long.compare(b.optLong("price"), a.optLong("price"))
                          : Long.compare(a.optLong("price"), b.optLong("price")));
          for (JSONObject p : visible) {
            Map<String, JSONObject> trial = new LinkedHashMap<>(current);
            trial.put(slot, p);
            List<String> issues = new ArrayList<>(BuildRules.check(trial).errors);
            issues.remove("У процессора нет встроенной графики — нужна видеокарта");
            JSONArray keys = p.optJSONArray("key");
            StringBuilder details = new StringBuilder();
            if (keys != null)
              for (int k = 0; k < keys.length(); k++) {
                if (k > 0) details.append(" · ");
                details.append(keys.optString(k));
              }
            rows.add(
                p.optString("name")
                    + "\n"
                    + money(p.optLong("price"))
                    + " · В наличии: "
                    + p.optInt("stock")
                    + (details.length() > 0 ? "\n" + details : "")
                    + (!issues.isEmpty() ? "\nЕсть несовместимость" : ""));
          }
          rows.notifyDataSetChanged();
          if (visible.isEmpty())
            search.setError("Нет подходящих товаров. Измените поиск или фильтр.");
          else search.setError(null);
        };
    search.addTextChangedListener(
        new TextWatcher() {
          public void beforeTextChanged(CharSequence s, int st, int c, int a) {}

          public void onTextChanged(CharSequence s, int st, int before, int c) {
            update.run();
          }

          public void afterTextChanged(Editable e) {}
        });
    compatible.setOnCheckedChangeListener((v, c) -> update.run());
    order.setOnItemSelectedListener(
        new android.widget.AdapterView.OnItemSelectedListener() {
          public void onItemSelected(android.widget.AdapterView<?> p, View v, int pos, long id) {
            update.run();
          }

          public void onNothingSelected(android.widget.AdapterView<?> p) {}
        });
    list.setOnItemClickListener(
        (parent, v, position, id) -> {
          Map<String, JSONObject> current = manualBuild();
          current.put(slot, visible.get(position));
          saveBuild(current);
          dialog.dismiss();
          builder();
        });
    update.run();
    dialog.show();
    dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setAllCaps(false);
    dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setTypeface(font(this, 600));
  }

  private void autoBuilder() {
    LinearLayout body = page();
    heading(
        body,
        "Ваш персональный ПК",
        "Подбор сборки",
        "Выберите бюджет и задачу. Подберём комплектующие и проверим совместимость.");
    EditText budget =
        formField(body, "Бюджет, ₸", "750000", android.text.InputType.TYPE_CLASS_NUMBER);
    Spinner purpose =
        spinner(
            body,
            "Основная задача",
            Arrays.asList(
                "Игры", "Универсальный ПК", "Стриминг и монтаж", "3D-рендер и ИИ", "Офис и учёба"),
            0);
    Spinner resolution =
        spinner(body, "Разрешение", Arrays.asList("Full HD 1080p", "2K 1440p", "4K 2160p"), 0);
    Spinner brand = spinner(body, "Процессор", Arrays.asList("Любой бренд", "Intel", "AMD"), 0);
    Spinner cooling =
        spinner(body, "Охлаждение", Arrays.asList("Автоматически", "Воздушное", "Жидкостное"), 0);
    CheckBox monitor = new CheckBox(this);
    monitor.setText("Включить монитор в бюджет");
    monitor.setTextColor(TEXT);
    add(body, monitor);
    CheckBox peripherals = new CheckBox(this);
    peripherals.setText("Включить клавиатуру и мышь в бюджет");
    peripherals.setTextColor(TEXT);
    add(body, peripherals);
    action(body, "К ручной сборке", false, this::builder);
    LinearLayout result = column(this);
    Button build = action(body, "Подобрать совместимую сборку", true, () -> {});
    build.setOnClickListener(
        v -> {
          long limit;
          try {
            limit = Long.parseLong(budget.getText().toString());
          } catch (Exception e) {
            budget.setError("Укажите бюджет");
            return;
          }
          hideKeyboard();
          int goal = purpose.getSelectedItemPosition();
          JSONObject catalog = store.state;
          int res = resolution.getSelectedItemPosition(),
              cpuBrand = brand.getSelectedItemPosition(),
              coolerType = cooling.getSelectedItemPosition();
          boolean needMonitor = monitor.isChecked(), needPeripherals = peripherals.isChecked();
          build.setEnabled(false);
          build.setText("Подбираем комплектующие…");
          async(
              () ->
                  BuildPicker.pick(
                      catalog,
                      limit,
                      goal,
                      res,
                      cpuBrand,
                      coolerType,
                      needMonitor,
                      needPeripherals),
              parts -> {
                build.setEnabled(true);
                build.setText("Подобрать совместимую сборку");
                if (result.isAttachedToWindow()) showBuild(result, parts);
              });
        });
    add(body, result);
  }

  private void showBuild(LinearLayout result, List<JSONObject> parts) {
    result.removeAllViews();
    if (parts.isEmpty()) {
      add(
          result,
          text(
              this,
              "Не удалось найти полный совместимый комплект в этом бюджете. Попробуйте увеличить"
                  + " сумму или выберите готовый ПК в каталоге.",
              15,
              MUTED,
              false));
      return;
    }
    action(
        result,
        "Продолжить в ручном конфигураторе",
        false,
        () -> {
          Map<String, JSONObject> draft = manualBuild();
          for (JSONObject p : parts) {
            String cat = p.optString("categoryId");
            draft.put(
                cat.equals("cooling")
                    ? "cooler"
                    : cat.equals("peripherals") ? BuildRules.specs(p).optString("kind") : cat,
                p);
          }
          saveBuild(draft);
          builder();
        });
    long sum = 0;
    for (JSONObject p : parts) {
      sum += p.optLong("price");
      LinearLayout card = card(this);
      JSONObject category = store.category(p.optString("categoryId"));
      add(
          card,
          text(
              this,
              category == null ? "Комплектующие" : category.optString("name"),
              11,
              ACCENT,
              true));
      gap(card, 6);
      TextView name = text(this, p.optString("name"), 15, TEXT, true);
      add(card, name);
      name.setOnClickListener(v -> navigate("product", p.optString("id")));
      gap(card, 6);
      add(card, text(this, money(p.optLong("price")), 16, TEXT, true));
      section(result, card);
    }
    section(result, text(this, "Совместимость проверена\nИтого: " + money(sum), 22, GREEN, true));
    action(
        result,
        "Добавить сборку в корзину",
        true,
        () -> {
          if (!verified()) {
            toast("Сначала проверим наличие всех деталей");
            refresh();
            return;
          }
          for (JSONObject p : parts) {
            JSONObject fresh = store.product(p.optString("id"));
            if (!buyable(fresh)
                || store.cart.getOrDefault(p.optString("id"), 0) >= fresh.optInt("stock")) {
              toast("Одна из деталей уже недоступна. Подберите сборку заново.");
              return;
            }
          }
          for (JSONObject p : parts) store.add(p.optString("id"));
          badges();
          toast("Сборка добавлена в корзину");
        });
  }

  @Override
  public void onBackPressed() {
    hideKeyboard();
    if (!history.isEmpty()) {
      String[] previous = history.pop();
      screen = previous[0];
      productId = previous[1];
      render();
      return;
    }
    if (selected != 0) {
      tab(0);
      return;
    }
    if (SystemClock.elapsedRealtime() - exitAt < 2000) {
      finish();
      return;
    }
    exitAt = SystemClock.elapsedRealtime();
    toast("Нажмите ещё раз, чтобы выйти");
  }

  @Override
  protected void onSaveInstanceState(Bundle state) {
    state.putString("screen", screen);
    state.putString("product", productId);
    state.putString("query", query);
    state.putString("category", category);
    state.putInt("tab", selected);
    super.onSaveInstanceState(state);
  }

  @Override
  protected void onResume() {
    super.onResume();
    foreground = true;
    verifiedAt = 0;
    verificationFailed = false;
    updateData();
    main.removeCallbacks(poll);
    poll.run();
  }

  @Override
  protected void onPause() {
    foreground = false;
    main.removeCallbacks(poll);
    super.onPause();
  }

  @Override
  protected void onDestroy() {
    main.removeCallbacks(poll);
    worker.shutdown();
    super.onDestroy();
  }
}
