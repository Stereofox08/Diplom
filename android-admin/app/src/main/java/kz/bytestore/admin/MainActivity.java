package kz.bytestore.admin;

import static kz.bytestore.admin.Ui.*;

import android.app.*;
import android.content.*;
import android.os.*;
import android.text.*;
import android.text.method.PasswordTransformationMethod;
import android.view.*;
import android.widget.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;
import org.json.*;

public final class MainActivity extends Activity {
  Store store;
  Api api;
  private LinearLayout root, content, navigation, toolbar;
  private TextView message, title;
  private ProgressBar progress;
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final Handler main = new Handler(Looper.getMainLooper());
  private String route = "dashboard", owner = "dashboard", record = "";
  private boolean pending, editing, dirty, mutationUnknown;
  private int pageSize = 20, generation;
  private long verifiedAt;
  private final Map<String, String> queries = new HashMap<>();
  private final List<Field> fields = new ArrayList<>();
  private JSONObject draft, restoredDraft;

  private static final class Retained {
    JSONObject state, draft;
    Store store;
    Api api;
    boolean mutationUnknown;
    String route, owner, record;
    Map<String, String> queries;
  }

  private LinearLayout formHost;

  interface Task<T> {
    T run() throws Exception;
  }

  @Override
  public void onCreate(Bundle saved) {
    Ui.applyTheme(this);
    setTheme(Ui.dark(this) ? R.style.AppThemeDark : R.style.AppTheme);
    super.onCreate(saved);
    getWindow().setStatusBarColor(BG);
    getWindow().setNavigationBarColor(SURFACE);
    getWindow()
        .getDecorView()
        .setSystemUiVisibility(
            Ui.dark(this)
                ? 0
                : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
    getWindow()
        .setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
    store = new Store(this);
    Retained retained = (Retained) getLastNonConfigurationInstance();
    if (retained != null) {
      store = retained.store;
      store.state = retained.state;
      mutationUnknown = retained.mutationUnknown;
      restoredDraft = retained.draft;
      route = retained.route;
      owner = retained.owner;
      record = retained.record;
      queries.putAll(retained.queries);
    }
    api = retained != null ? retained.api : new Api(store);
    root = column(this);
    root.setBackgroundColor(BG);
    root.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          int top = insets.getSystemWindowInsetTop(), bottom = insets.getSystemWindowInsetBottom();
          root.setPadding(
              insets.getSystemWindowInsetLeft(), top, insets.getSystemWindowInsetRight(), bottom);
          return insets;
        });
    toolbar = row(this);
    toolbar.setPadding(d(16), d(10), d(16), d(10));
    toolbar.setBackgroundColor(SURFACE);
    ImageView mark = new ImageView(this);
    mark.setImageResource(R.drawable.ic_launcher);
    toolbar.addView(mark, new LinearLayout.LayoutParams(d(38), d(38)));
    title = text(this, "ByteStore Admin", 19, TEXT, true);
    LinearLayout.LayoutParams t = new LinearLayout.LayoutParams(0, -2, 1);
    t.leftMargin = d(12);
    toolbar.addView(title, t);
    Button menu = button(this, "Разделы", false);
    menu.setOnClickListener(v -> navigate("more", ""));
    toolbar.addView(menu);
    Button reload = button(this, "↻", false);
    reload.setContentDescription("Обновить данные");
    toolbar.addView(reload, new LinearLayout.LayoutParams(d(46), d(46)));
    reload.setOnClickListener(v -> refresh());
    add(root, toolbar);
    progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
    progress.setIndeterminate(true);
    progress.setVisibility(View.INVISIBLE);
    root.addView(progress, new LinearLayout.LayoutParams(-1, d(3)));
    message = text(this, "", 13, RED, false);
    message.setPadding(d(16), d(8), d(16), d(8));
    message.setVisibility(View.GONE);
    add(root, message);
    content = column(this);
    root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
    navigation = row(this);
    navigation.setBackgroundColor(SURFACE);
    add(root, navigation);
    setContentView(root);
    if (saved != null && retained == null) {
      route = saved.getString("route", "dashboard");
      record = saved.getString("record", "");
    }
    render();
    if (store.session != null) refresh();
  }

  int d(float n) {
    return dp(this, n);
  }

  private void feedback(String text) {
    message.setText(text);
    message.setVisibility(text.isEmpty() ? View.GONE : View.VISIBLE);
    message.announceForAccessibility(text);
  }

  private void busy(boolean active) {
    pending = active;
    progress.setVisibility(active ? View.VISIBLE : View.INVISIBLE);
    enable(root, !active);
  }

  private void enable(View v, boolean enabled) {
    if (v instanceof Button
        || v instanceof EditText
        || v instanceof Spinner
        || v instanceof CheckBox) v.setEnabled(enabled);
    if (v instanceof android.view.ViewGroup) {
      android.view.ViewGroup g = (android.view.ViewGroup) v;
      for (int i = 0; i < g.getChildCount(); i++) enable(g.getChildAt(i), enabled);
    }
  }

  <T> void task(Task<T> job, Consumer<T> done) {
    if (pending) return;
    final boolean wasAuthenticated = store.session != null;
    busy(true);
    feedback("");
    worker.execute(
        () -> {
          try {
            T result = job.run();
            main.post(
                () -> {
                  if (isFinishing() || isDestroyed()) return;
                  busy(false);
                  done.accept(result);
                });
          } catch (Exception e) {
            main.post(
                () -> {
                  if (isFinishing() || isDestroyed()) return;
                  busy(false);
                  if (e instanceof Api.Failure && ((Api.Failure) e).status < 500)
                    mutationUnknown = false;
                  if ((wasAuthenticated && store.session == null)
                      || e instanceof Api.Failure
                          && (((Api.Failure) e).status == 401 || ((Api.Failure) e).status == 403)) {
                    try {
                      store.saveSession(null);
                    } catch (Exception ignored) {
                    }
                    render();
                  }
                  feedback(
                      e.getMessage() == null
                          ? "Не удалось выполнить действие. Повторите попытку."
                          : e.getMessage());
                });
          }
        });
  }

  private void refresh() {
    task(
        () -> {
          JSONObject s = api.snapshot();
          requireAdmin(s);
          return s;
        },
        s -> {
          store.state = s;
          verifiedAt = SystemClock.elapsedRealtime();
          mutationUnknown = false;
          if (!editing) render();
          else {
            JSONObject fresh =
                owner.equals("products") ? Store.find(store.array("products"), record) : null;
            if (draft != null
                && fresh != null
                && fresh.optLong("revision") != draft.optLong("revision")) {
              confirm(
                  "Товар изменился",
                  "Загрузить актуальную версию товара? Введённые здесь изменения будут потеряны.",
                  "Загрузить",
                  () -> {
                    dirty = false;
                    restoredDraft = null;
                    edit("products", fresh);
                  });
              feedback(
                  "На сервере есть новая версия товара. Можно загрузить её или сохранить свой ввод"
                      + " в форме для сравнения.");
            } else feedback("Данные обновлены. Ваши изменения сохранены в форме.");
          }
        });
  }

  static void requireAdmin(JSONObject s) throws Exception {
    if (!s.optBoolean("isAdmin"))
      throw new Api.Failure(
          403,
          "Доступ только для администратора ByteStore. Войдите под учётной записью"
              + " администратора.");
  }

  private LinearLayout page() {
    content.removeAllViews();
    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    LinearLayout b = column(this);
    b.setPadding(d(16), d(20), d(16), d(24));
    scroll.addView(b);
    content.addView(scroll, new LinearLayout.LayoutParams(-1, -1));
    return b;
  }

  private void section(LinearLayout b, View v) {
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
    lp.bottomMargin = d(14);
    b.addView(v, lp);
  }

  private void heading(LinearLayout b, String h, String sub) {
    section(b, text(this, h, 27, TEXT, true));
    if (!sub.isEmpty()) section(b, text(this, sub, 14, MUTED, false));
  }

  private Button action(LinearLayout b, String label, boolean primary, Runnable run) {
    Button button = button(this, label, primary);
    section(b, button);
    button.setOnClickListener(
        v -> {
          if (!pending) run.run();
        });
    return button;
  }

  private void navigate(String next, String id) {
    if (pending) return;
    if (dirty) {
      confirm(
          "Выйти без сохранения?",
          "Изменения в форме будут потеряны.",
          "Выйти",
          () -> {
            dirty = false;
            go(next, id);
          });
    } else go(next, id);
  }

  private void go(String next, String id) {
    route = next;
    record = id;
    editing = false;
    draft = null;
    fields.clear();
    pageSize = 20;
    generation++;
    feedback("");
    render();
  }

  private void render() {
    if (store.session == null) {
      editing = false;
      draft = null;
      restoredDraft = null;
      currentSpecs = null;
      photoField = null;
      fields.clear();
      queries.clear();
      navigation.setVisibility(View.GONE);
      toolbar.setVisibility(View.GONE);
      login();
      return;
    }
    if (!store.state.optBoolean("isAdmin")) {
      navigation.setVisibility(View.GONE);
      toolbar.setVisibility(View.GONE);
      LinearLayout b = page();
      heading(b, "Проверяем доступ", "Подключаемся к ByteStore…");
      action(b, "Повторить", true, this::refresh);
      action(b, "Выйти", false, this::logout);
      return;
    }
    toolbar.setVisibility(View.VISIBLE);
    navigation.setVisibility(View.VISIBLE);
    navigation.removeAllViews();
    String[] ids = {"dashboard", "products", "orders", "more"},
        labels = {"Обзор", "Товары", "Заказы", "Ещё"};
    for (int i = 0; i < ids.length; i++) {
      String id = ids[i];
      Button tab = button(this, labels[i], route.equals(id));
      navigation.addView(tab, new LinearLayout.LayoutParams(0, d(52), 1));
      tab.setOnClickListener(v -> navigate(id, ""));
    }
    if (route.equals("edit")) {
      edit(owner, Store.find(store.array(owner), record));
      return;
    }
    if (route.equals("detail")) {
      detail(owner, Store.find(store.array(owner), record));
      return;
    }
    if (route.equals("dashboard")) dashboard();
    else if (route.equals("more")) more();
    else if (route.equals("settings") || route.equals("ai")) settings(route.equals("ai"));
    else list(route);
  }

  private void login() {
    LinearLayout b = page();
    ImageView logo = new ImageView(this);
    logo.setImageResource(R.drawable.ic_launcher);
    b.addView(logo, new LinearLayout.LayoutParams(d(86), d(86)));
    gap(b, 20);
    heading(b, "ByteStore Admin", "Управление магазином");
    LinearLayout card = card(this);
    section(b, card);
    EditText email =
        input(
            card,
            "E-mail",
            "",
            android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
    EditText password =
        input(
            card,
            "Пароль",
            "",
            android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
    password.setTransformationMethod(PasswordTransformationMethod.getInstance());
    CheckBox show = new CheckBox(this);
    show.setText("Показать пароль");
    show.setTextColor(TEXT);
    add(card, show);
    show.setOnCheckedChangeListener(
        (v, on) ->
            password.setTransformationMethod(
                on ? null : PasswordTransformationMethod.getInstance()));
    action(
        card,
        "Войти",
        true,
        () -> {
          String e = email.getText().toString().trim(), p = password.getText().toString();
          if (!android.util.Patterns.EMAIL_ADDRESS.matcher(e).matches()) {
            email.setError("Укажите e-mail");
            email.requestFocus();
            return;
          }
          if (p.isEmpty()) {
            password.setError("Введите пароль");
            password.requestFocus();
            return;
          }
          task(
              () -> {
                JSONObject token =
                    api.request(
                        "/auth/v1/token?grant_type=password",
                        Store.obj("email", e, "password", p),
                        false);
                api.setSession(token);
                try {
                  JSONObject s = api.snapshot();
                  requireAdmin(s);
                  return s;
                } catch (Exception ex) {
                  store.saveSession(null);
                  throw ex;
                }
              },
              s -> {
                password.setText("");
                store.state = s;
                verifiedAt = SystemClock.elapsedRealtime();
                mutationUnknown = false;
                route = "dashboard";
                render();
              });
        });
    section(
        b,
        text(
            this, "Вход предназначен для сотрудников с правами администратора.", 13, MUTED, false));
    action(b, "Тема оформления", false, this::theme);
  }

  private EditText input(LinearLayout b, String label, String value, int type) {
    TextView l = text(this, label, 13, MUTED, true);
    add(b, l);
    gap(b, 6);
    EditText e = field(this, label, type);
    e.setId(View.generateViewId());
    l.setLabelFor(e.getId());
    e.setText(value);
    section(b, e);
    return e;
  }

  private void dashboard() {
    LinearLayout b = page();
    heading(b, "Магазин сегодня", "Товары, заказы и задачи управления");
    int low = 0, newOrders = 0, pendingReviews = 0;
    long revenue = 0;
    for (int i = 0; i < store.array("products").length(); i++)
      if (store.array("products").optJSONObject(i).optInt("stock") <= 3) low++;
    for (int i = 0; i < store.array("orders").length(); i++) {
      JSONObject o = store.array("orders").optJSONObject(i);
      if (o.optString("status").equals("new")) newOrders++;
      if (!o.optString("status").equals("cancelled")) revenue += o.optLong("total");
    }
    for (int i = 0; i < store.array("reviews").length(); i++)
      if (store.array("reviews").optJSONObject(i).optString("status").equals("pending"))
        pendingReviews++;
    metric(b, "Заказы без отмен", money(revenue), "orders");
    metric(b, "Новые заказы", String.valueOf(newOrders), "orders");
    metric(b, "Товаров в каталоге", String.valueOf(store.array("products").length()), "products");
    metric(b, "Остаток 3 шт. и меньше", String.valueOf(low), "products");
    metric(b, "Отзывы на модерации", String.valueOf(pendingReviews), "reviews");
    action(b, "Обновить данные", false, this::refresh);
  }

  private void metric(LinearLayout b, String label, String value, String next) {
    LinearLayout c = card(this);
    add(c, text(this, label, 13, MUTED, false));
    gap(c, 10);
    add(c, text(this, value, 28, TEXT, true));
    action(c, "Открыть →", false, () -> navigate(next, ""));
    section(b, c);
  }

  private String label(String kind) {
    switch (kind) {
      case "products":
        return "Товары";
      case "orders":
        return "Заказы";
      case "users":
        return "Клиенты";
      case "reviews":
        return "Отзывы";
      case "categories":
        return "Категории";
      case "promos":
        return "Промокоды";
      case "images":
        return "Фотографии";
      case "audit":
        return "Журнал действий";
      default:
        return kind;
    }
  }

  private void more() {
    LinearLayout b = page();
    heading(b, "Управление", "Все разделы ByteStore");
    for (String key : new String[] {"categories", "users", "reviews", "promos", "images", "audit"})
      action(b, label(key) + " →", false, () -> navigate(key, ""));
    action(b, "Настройки магазина", false, () -> navigate("settings", ""));
    action(b, "Настройки ИИ", false, () -> navigate("ai", ""));
    action(b, "Тема оформления", false, this::theme);
    action(b, "Обновить данные", false, this::refresh);
    action(
        b,
        "Выйти из аккаунта",
        false,
        () ->
            confirm(
                "Выйти из админки?",
                "Данные покупателей будут удалены из памяти приложения.",
                "Выйти",
                this::logout));
  }

  private void theme() {
    String[] v = {"light", "dark", "system"};
    String current = getSharedPreferences("appearance", 0).getString("theme", "light");
    new AlertDialog.Builder(this)
        .setTitle("Тема оформления")
        .setSingleChoiceItems(
            new String[] {"Светлая", "Тёмная", "Как на устройстве"},
            Arrays.asList(v).indexOf(current),
            (dialog, pos) -> {
              getSharedPreferences("appearance", 0).edit().putString("theme", v[pos]).apply();
              dialog.dismiss();
              recreate();
            })
        .setNegativeButton("Отмена", null)
        .show();
  }

  private void logout() {
    task(
        () -> {
          try {
            api.request("/auth/v1/logout?scope=local", new JSONObject(), true);
          } catch (Exception ignored) {
          }
          store.saveSession(null);
          return true;
        },
        done -> {
          dirty = false;
          editing = false;
          verifiedAt = 0;
          draft = null;
          restoredDraft = null;
          currentSpecs = null;
          photoField = null;
          fields.clear();
          queries.clear();
          route = "dashboard";
          render();
        });
  }

  private void list(String kind) {
    LinearLayout b = page();
    heading(
        b,
        label(kind),
        kind.equals("audit") ? "Последние действия · время Алматы" : "Общие данные магазина");
    if (Arrays.asList("products", "categories", "promos").contains(kind))
      action(
          b,
          "Добавить",
          true,
          () -> {
            owner = kind;
            navigate("edit", "");
          });
    LinearLayout searchRow = row(this);
    EditText search = field(this, "Поиск", android.text.InputType.TYPE_CLASS_TEXT);
    search.setContentDescription("Поиск: " + label(kind));
    search.setText(queries.getOrDefault(kind, ""));
    searchRow.addView(search, new LinearLayout.LayoutParams(0, -2, 1));
    Button clear = button(this, "×", false);
    clear.setContentDescription("Очистить поиск");
    searchRow.addView(clear, new LinearLayout.LayoutParams(d(46), d(46)));
    clear.setVisibility(search.length() > 0 ? View.VISIBLE : View.GONE);
    section(b, searchRow);
    LinearLayout rows = column(this);
    add(b, rows);
    Runnable update =
        () -> {
          rows.removeAllViews();
          String q = search.getText().toString().trim().toLowerCase(Locale.ROOT);
          List<JSONObject> found = new ArrayList<>();
          JSONArray data = store.array(kind.equals("images") ? "products" : kind);
          for (int i = 0; i < data.length(); i++) {
            JSONObject p = data.optJSONObject(i);
            if (p != null && searchText(p, kind).toLowerCase(Locale.ROOT).contains(q)) found.add(p);
          }
          section(rows, text(this, "Найдено: " + found.size(), 13, MUTED, false));
          for (int i = 0; i < Math.min(pageSize, found.size()); i++) {
            JSONObject p = found.get(i);
            LinearLayout c = card(this);
            add(c, text(this, rowTitle(p, kind), 16, TEXT, true));
            gap(c, 6);
            add(c, text(this, rowSubtitle(p, kind), 13, MUTED, false));
            if (!kind.equals("audit"))
              action(
                  c,
                  kind.equals("images") ? "Изменить фото" : "Открыть →",
                  false,
                  () -> {
                    owner = kind.equals("images") ? "products" : kind;
                    navigate("detail", p.optString("id", p.optString("code")));
                  });
            section(rows, c);
          }
          if (found.isEmpty())
            section(
                rows,
                text(
                    this,
                    q.isEmpty() ? "Записей пока нет" : "Ничего не найдено. Измените запрос.",
                    15,
                    MUTED,
                    false));
          if (found.size() > pageSize)
            action(
                rows,
                "Показать ещё",
                false,
                () -> {
                  pageSize += 20;
                  list(kind);
                });
        };
    search.addTextChangedListener(
        new TextWatcher() {
          public void beforeTextChanged(CharSequence s, int st, int c, int a) {}

          public void onTextChanged(CharSequence s, int st, int before, int c) {
            queries.put(kind, s.toString());
            pageSize = 20;
            clear.setVisibility(s.length() > 0 ? View.VISIBLE : View.GONE);
            update.run();
          }

          public void afterTextChanged(Editable e) {}
        });
    clear.setOnClickListener(
        v -> {
          search.setText("");
          search.requestFocus();
        });
    update.run();
  }

  private String searchText(JSONObject p, String kind) {
    return rowTitle(p, kind)
        + " "
        + rowSubtitle(p, kind)
        + " "
        + p.optString("sku")
        + " "
        + p.optString("phone");
  }

  private String rowTitle(JSONObject p, String kind) {
    switch (kind) {
      case "orders":
        return p.optString("number");
      case "promos":
        return p.optString("code");
      case "reviews":
        return p.optString("productName");
      case "audit":
        return auditLabel(p.optString("action"));
      default:
        return p.optString("name", p.optString("email"));
    }
  }

  private String auditLabel(String op) {
    switch (op) {
      case "saveProduct":
        return "Сохранение товара";
      case "updateStock":
        return "Обновление остатка";
      case "setOrderStatus":
        return "Изменение статуса заказа";
      case "savePromo":
        return "Сохранение промокода";
      case "saveCategory":
        return "Сохранение категории";
      case "updateSettings":
        return "Настройки магазина";
      case "setUserStatus":
        return "Статус клиента";
      default:
        return op;
    }
  }

  private String rowSubtitle(JSONObject p, String kind) {
    switch (kind) {
      case "products":
      case "images":
        return money(p.optLong("price"))
            + " · "
            + p.optInt("stock")
            + " шт. · "
            + status(p.optString("status"));
      case "orders":
        return status(p.optString("status"))
            + " · "
            + money(p.optLong("total"))
            + "\n"
            + (p.optJSONObject("customer") == null
                ? ""
                : p.optJSONObject("customer").optString("name", ""));
      case "users":
        return p.optString("email") + " · " + status(p.optString("status"));
      case "reviews":
        return p.optString("author")
            + " · "
            + p.optInt("rating")
            + "/5 · "
            + status(p.optString("status"));
      case "promos":
        return (p.optString("type").equals("percent")
                ? p.optLong("value") + "%"
                : money(p.optLong("value")))
            + " · "
            + (p.optBoolean("active") ? "Активен" : "Выключен");
      case "audit":
        java.text.DateFormat df =
            new java.text.SimpleDateFormat("dd.MM.yyyy HH:mm", new Locale("ru", "KZ"));
        df.setTimeZone(TimeZone.getTimeZone("Asia/Almaty"));
        return df.format(new Date(p.optLong("ts"))) + "\n" + p.optString("user");
      default:
        return p.optString("description", p.optString("id"));
    }
  }

  static String status(String s) {
    switch (s) {
      case "active":
        return "Активен";
      case "hidden":
        return "Скрыт";
      case "blocked":
        return "Заблокирован";
      case "new":
        return "Новый";
      case "processing":
        return "В обработке";
      case "shipped":
        return "Отправлен";
      case "delivered":
        return "Получен";
      case "cancelled":
        return "Отменён";
      case "published":
        return "Опубликован";
      case "pending":
        return "На модерации";
      case "rejected":
        return "Отклонён";
      default:
        return s;
    }
  }

  private void detail(String kind, JSONObject p) {
    if (p == null) {
      go(kind, "");
      return;
    }
    LinearLayout b = page();
    heading(b, rowTitle(p, kind), rowSubtitle(p, kind));
    action(b, "← К списку", false, () -> navigate(kind, ""));
    if (kind.equals("products")) {
      section(b, text(this, p.optString("description"), 15, TEXT, false));
      section(
          b,
          text(
              this,
              "Артикул: "
                  + p.optString("sku")
                  + "\nБренд: "
                  + p.optString("brand")
                  + "\nСебестоимость: "
                  + money(p.optLong("cost")),
              14,
              MUTED,
              false));
      JSONObject specs = p.optJSONObject("specs");
      if (specs != null) {
        Iterator<String> keys = specs.keys();
        while (keys.hasNext()) {
          String k = keys.next();
          section(b, text(this, specLabel(k) + ": " + specs.opt(k), 14, TEXT, false));
        }
      }
      action(b, "Редактировать товар", true, () -> navigate("edit", p.optString("id")));
      action(b, "Изменить остаток", false, () -> stock(p));
      action(
          b,
          "Создать копию",
          false,
          () ->
              confirm(
                  "Создать копию?",
                  p.optString("name") + " будет скопирован как скрытый товар.",
                  "Создать копию",
                  () -> command("duplicateProduct", new JSONArray().put(p.optString("id")), kind)));
      action(
          b,
          "Удалить товар",
          false,
          () ->
              confirm(
                  "Удалить товар?",
                  p.optString("name") + " будет удалён из общего каталога.",
                  "Удалить",
                  () -> command("deleteProduct", new JSONArray().put(p.optString("id")), kind)));
    } else if (kind.equals("orders")) {
      JSONObject customer = p.optJSONObject("customer");
      section(
          b,
          text(
              this,
              customer == null
                  ? ""
                  : customer.optString("name")
                      + "\n"
                      + customer.optString("email")
                      + "\n"
                      + customer.optString("phone"),
              15,
              TEXT,
              false));
      section(
          b,
          text(
              this,
              p.optString("city")
                  + " · "
                  + p.optString("address")
                  + "\n"
                  + p.optString("deliveryType")
                  + " · "
                  + p.optString("payment"),
              14,
              MUTED,
              false));
      JSONArray items = p.optJSONArray("items");
      if (items != null)
        for (int i = 0; i < items.length(); i++) {
          JSONObject item = items.optJSONObject(i);
          section(
              b,
              text(
                  this,
                  item.optString("name")
                      + " × "
                      + item.optInt("qty")
                      + " · "
                      + money(item.optLong("price")),
                  14,
                  TEXT,
                  false));
        }
      section(b, text(this, "Комментарий покупателя: " + p.optString("comment"), 14, MUTED, false));
      action(b, "Изменить статус", true, () -> orderStatus(p));
      EditText note =
          input(
              b,
              "Комментарий менеджера",
              p.optString("managerComment"),
              android.text.InputType.TYPE_CLASS_TEXT
                  | android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE);
      action(
          b,
          "Сохранить комментарий",
          false,
          () ->
              command(
                  "updateOrderComment",
                  new JSONArray().put(p.optString("id")).put(note.getText().toString()),
                  kind));
      JSONArray h = p.optJSONArray("history");
      if (h != null) {
        section(b, text(this, "История заказа", 20, TEXT, true));
        for (int i = 0; i < h.length(); i++)
          section(
              b,
              text(
                  this,
                  status(h.optJSONObject(i).optString("status"))
                      + " · "
                      + h.optJSONObject(i).optString("comment"),
                  13,
                  MUTED,
                  false));
      }
    } else if (kind.equals("users")) {
      section(
          b,
          text(
              this,
              "Телефон: "
                  + p.optString("phone")
                  + "\nРассылка: "
                  + (p.optBoolean("newsletter") ? "Да" : "Нет"),
              15,
              TEXT,
              false));
      int n = 0;
      long sum = 0;
      for (int i = 0; i < store.array("orders").length(); i++) {
        JSONObject o = store.array("orders").optJSONObject(i);
        if (o.optString("userId").equals(p.optString("id"))) {
          n++;
          sum += o.optLong("total");
        }
      }
      section(b, text(this, "Заказов: " + n + " · " + money(sum), 18, TEXT, true));
      boolean blocked = p.optString("status").equals("blocked");
      action(
          b,
          blocked ? "Разблокировать клиента" : "Заблокировать клиента",
          false,
          () ->
              confirm(
                  blocked ? "Разблокировать клиента?" : "Заблокировать клиента?",
                  p.optString("email"),
                  blocked ? "Разблокировать" : "Заблокировать",
                  () ->
                      command(
                          "setUserStatus",
                          new JSONArray()
                              .put(p.optString("id"))
                              .put(blocked ? "active" : "blocked"),
                          kind)));
    } else if (kind.equals("reviews")) {
      action(b, "Редактировать отзыв", false, () -> navigate("edit", p.optString("id")));
      section(b, text(this, p.optString("text"), 16, TEXT, false));
      section(
          b,
          text(
              this,
              "Плюсы: " + p.optString("pros") + "\nМинусы: " + p.optString("cons"),
              14,
              MUTED,
              false));
      EditText reply =
          input(
              b,
              "Ответ магазина",
              p.optString("reply"),
              android.text.InputType.TYPE_CLASS_TEXT
                  | android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE);
      action(
          b,
          "Сохранить ответ",
          true,
          () ->
              command(
                  "replyReview",
                  new JSONArray().put(p.optString("id")).put(reply.getText().toString()),
                  kind));
      action(
          b,
          "Опубликовать",
          false,
          () ->
              command(
                  "setReviewStatus",
                  new JSONArray().put(p.optString("id")).put("published"),
                  kind));
      action(
          b,
          "Отклонить",
          false,
          () ->
              confirm(
                  "Отклонить отзыв?",
                  "Отзыв не будет показываться покупателям.",
                  "Отклонить",
                  () ->
                      command(
                          "setReviewStatus",
                          new JSONArray().put(p.optString("id")).put("rejected"),
                          kind)));
      action(
          b,
          "Удалить отзыв",
          false,
          () ->
              confirm(
                  "Удалить отзыв?",
                  "Отзыв будет удалён без возможности восстановления.",
                  "Удалить",
                  () -> command("deleteReview", new JSONArray().put(p.optString("id")), kind)));
    } else {
      action(
          b, "Редактировать", true, () -> navigate("edit", p.optString("id", p.optString("code"))));
      if (kind.equals("promos"))
        action(
            b,
            p.optBoolean("active") ? "Выключить промокод" : "Включить промокод",
            false,
            () -> {
              JSONObject changed = copy(p);
              try {
                changed.put("active", !p.optBoolean("active"));
              } catch (Exception ignored) {
              }
              command("savePromo", new JSONArray().put(changed), kind);
            });
      action(
          b,
          "Удалить",
          false,
          () ->
              confirm(
                  "Удалить запись?",
                  rowTitle(p, kind) + " будет удалён из общего магазина.",
                  "Удалить",
                  () ->
                      command(
                          kind.equals("categories") ? "deleteCategory" : "deletePromo",
                          new JSONArray().put(p.optString("id", p.optString("code"))),
                          kind)));
    }
  }

  private JSONObject copy(JSONObject p) {
    try {
      return p == null ? new JSONObject() : new JSONObject(p.toString());
    } catch (Exception e) {
      return new JSONObject();
    }
  }

  private void confirm(String name, String body, String verb, Runnable yes) {
    new AlertDialog.Builder(this)
        .setTitle(name)
        .setMessage(body)
        .setNegativeButton("Отмена", null)
        .setPositiveButton(verb, (d, w) -> yes.run())
        .show();
  }

  private void orderStatus(JSONObject p) {
    String[] codes = {"new", "processing", "shipped", "delivered", "cancelled"};
    String[] names = new String[codes.length];
    for (int i = 0; i < codes.length; i++) names[i] = status(codes[i]);
    new AlertDialog.Builder(this)
        .setTitle("Статус заказа")
        .setItems(
            names,
            (dialog, index) ->
                confirm(
                    "Изменить статус?",
                    p.optString("number")
                        + " → "
                        + names[index]
                        + (index == 4 ? ". Остатки товаров будут восстановлены." : ""),
                    "Изменить",
                    () ->
                        command(
                            "setOrderStatus",
                            new JSONArray()
                                .put(p.optString("id"))
                                .put(codes[index])
                                .put("Из мобильной админки"),
                            "orders")))
        .setNegativeButton("Отмена", null)
        .show();
  }

  private void stock(JSONObject p) {
    LinearLayout b = column(this);
    b.setPadding(d(20), d(8), d(20), 0);
    EditText n =
        input(
            b,
            "Остаток, шт.",
            String.valueOf(p.optInt("stock")),
            android.text.InputType.TYPE_CLASS_NUMBER);
    AlertDialog dialog =
        new AlertDialog.Builder(this)
            .setTitle("Изменить остаток")
            .setView(b)
            .setNegativeButton("Отмена", null)
            .setPositiveButton("Сохранить", null)
            .create();
    dialog.setOnShowListener(
        v ->
            dialog
                .getButton(-1)
                .setOnClickListener(
                    btn -> {
                      try {
                        int count = Integer.parseInt(n.getText().toString());
                        if (count < 0) throw new Exception();
                        dialog.dismiss();
                        command(
                            "updateStock",
                            new JSONArray()
                                .put(p.optString("id"))
                                .put(count)
                                .put(p.optLong("revision")),
                            "products");
                      } catch (Exception e) {
                        n.setError("Введите целое число от 0");
                      }
                    }));
    dialog.show();
  }

  private void command(String operation, JSONArray args, String destination) {
    if (mutationUnknown) {
      feedback(
          "Результат прошлого запроса неизвестен. Обновите данные кнопкой ↻, затем проверьте"
              + " запись.");
      return;
    }
    if (!store.state.optBoolean("isAdmin")) {
      feedback("Требуются права администратора");
      return;
    }
    mutationUnknown = true;
    task(
        () -> {
          api.request("/rest/v1/rpc/store_command", Store.obj("op", operation, "args", args), true);
          return true;
        },
        ok -> {
          mutationUnknown = false;
          dirty = false;
          editing = false;
          go(destination, "");
          feedback("Изменения сохранены. Обновляем данные…");
          refresh();
        });
  }

  private static final class Field {
    JSONObject target;
    String key, type, label;
    View view;
    String[] codes;
    boolean required;

    Field(JSONObject target, String key, String type, String label, View view) {
      this.target = target;
      this.key = key;
      this.type = type;
      this.label = label;
      this.view = view;
    }
  }

  private EditText bind(
      LinearLayout b, JSONObject target, String key, String label, String type, boolean required) {
    String value = target.has(key) ? target.optString(key) : "";
    if (type.equals("lines") && target.optJSONArray(key) != null) {
      JSONArray a = target.optJSONArray(key);
      List<String> parts = new ArrayList<>();
      for (int i = 0; i < a.length(); i++) parts.add(a.optString(i));
      value = String.join("\n", parts);
    }
    int inputType =
        type.equals("number")
            ? android.text.InputType.TYPE_CLASS_NUMBER
            : type.equals("decimal")
                ? android.text.InputType.TYPE_CLASS_NUMBER
                    | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
                : android.text.InputType.TYPE_CLASS_TEXT
                    | android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE;
    EditText e =
        input(
            b,
            label,
            type.equals("image") && value.startsWith("data:image/") ? "" : value,
            inputType);
    if (type.equals("image")) {
      e.setSingleLine(true);
      if (value.startsWith("data:image/")) e.setHint("Фото с телефона выбрано");
    }
    if (type.equals("secret")) {
      e.setInputType(
          android.text.InputType.TYPE_CLASS_TEXT
              | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
      CheckBox reveal = new CheckBox(this);
      reveal.setText("Показать ключ");
      reveal.setTextColor(TEXT);
      add(b, reveal);
      reveal.setOnCheckedChangeListener(
          (v, on) ->
              e.setTransformationMethod(on ? null : PasswordTransformationMethod.getInstance()));
    }
    Field f = new Field(target, key, type, label, e);
    f.required = required;
    fields.add(f);
    e.addTextChangedListener(
        new TextWatcher() {
          public void beforeTextChanged(CharSequence s, int st, int c, int a) {}

          public void onTextChanged(CharSequence s, int st, int before, int c) {
            dirty = true;
          }

          public void afterTextChanged(Editable e) {}
        });
    return e;
  }

  private void toggle(LinearLayout b, JSONObject target, String key, String label) {
    CheckBox check = new CheckBox(this);
    check.setText(label);
    check.setTextColor(TEXT);
    check.setTypeface(font(this, 400));
    check.setChecked(target.optBoolean(key));
    section(b, check);
    fields.add(new Field(target, key, "boolean", label, check));
    check.setOnCheckedChangeListener((v, on) -> dirty = true);
  }

  private Spinner choice(
      LinearLayout b,
      JSONObject target,
      String key,
      String label,
      String[] codes,
      String[] labels) {
    add(b, text(this, label, 13, MUTED, true));
    Spinner spinner = new Spinner(this);
    ArrayAdapter<String> adapter =
        new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, labels);
    spinner.setAdapter(adapter);
    int initial = Arrays.asList(codes).indexOf(target.optString(key));
    spinner.setSelection(Math.max(0, initial));
    section(b, spinner);
    Field f = new Field(target, key, "choice", label, spinner);
    f.codes = codes;
    fields.add(f);
    spinner.setOnItemSelectedListener(
        new AdapterView.OnItemSelectedListener() {
          boolean first = true;

          public void onItemSelected(AdapterView<?> p, View v, int pos, long id) {
            if (first) {
              first = false;
              return;
            }
            dirty = true;
          }

          public void onNothingSelected(AdapterView<?> p) {}
        });
    return spinner;
  }

  private boolean collect() {
    for (Field f : fields) {
      try {
        Object value;
        if (f.type.equals("boolean")) value = ((CheckBox) f.view).isChecked();
        else if (f.type.equals("choice"))
          value = f.codes[((Spinner) f.view).getSelectedItemPosition()];
        else {
          EditText e = (EditText) f.view;
          String raw = e.getText().toString().trim();
          if (f.required && raw.isEmpty()) throw new Exception("Заполните поле «" + f.label + "»");
          if (f.type.equals("number") || f.type.equals("decimal")) {
            double number = raw.isEmpty() ? 0 : Double.parseDouble(raw.replace(',', '.'));
            if (!Double.isFinite(number) || number < 0 || f.key.equals("price") && number <= 0)
              throw new Exception("Укажите допустимое число");
            if (f.type.equals("number") && number != Math.floor(number))
              throw new Exception("Введите целое число");
            value =
                f.type.equals("number")
                    ? (Object) Long.valueOf((long) number)
                    : (Object) Double.valueOf(number);
          } else if (f.type.equals("lines")) {
            JSONArray lines = new JSONArray();
            for (String row : raw.split("\n")) if (!row.trim().isEmpty()) lines.put(row.trim());
            value = lines;
          } else if (f.type.equals("image")
              && raw.isEmpty()
              && f.target.optString(f.key).startsWith("data:image/"))
            value = f.target.optString(f.key);
          else value = raw;
        }
        f.target.put(f.key, value);
      } catch (Exception ex) {
        if (f.view instanceof EditText) {
          ((EditText) f.view).setError(ex.getMessage());
          f.view.requestFocus();
        }
        feedback("Проверьте поле «" + f.label + "»");
        return false;
      }
    }
    return true;
  }

  private void edit(String kind, JSONObject existing) {
    editing = true;
    owner = kind;
    draft = copy(restoredDraft != null ? restoredDraft : existing);
    restoredDraft = null;
    fields.clear();
    LinearLayout b = page();
    formHost = b;
    heading(
        b,
        existing == null ? "Добавить: " + label(kind) : "Редактирование",
        existing == null ? "Новая запись в общем магазине" : rowTitle(existing, kind));
    if (existing == null && !draft.has("id"))
      try {
        if (kind.equals("products"))
          draft
              .put("id", "p-" + UUID.randomUUID())
              .put("status", "hidden")
              .put("revision", 0)
              .put("specs", new JSONObject());
        else if (kind.equals("categories")) draft.put("id", "category-" + UUID.randomUUID());
      } catch (Exception ignored) {
      }
    if (kind.equals("products")) {
      bind(b, draft, "name", "Название товара", "text", true);
      bind(b, draft, "brand", "Бренд", "text", false);
      bind(b, draft, "sku", "Артикул", "text", false);
      JSONArray cats = store.array("categories");
      String[] codes = new String[cats.length()], names = new String[cats.length()];
      for (int i = 0; i < cats.length(); i++) {
        codes[i] = cats.optJSONObject(i).optString("id");
        names[i] = cats.optJSONObject(i).optString("name");
      }
      if (codes.length == 0) {
        feedback("Создайте категорию перед добавлением товара");
        return;
      }
      Spinner cat = choice(b, draft, "categoryId", "Категория", codes, names);
      bind(b, draft, "price", "Цена, ₸", "number", true);
      bind(b, draft, "oldPrice", "Старая цена, ₸", "number", false);
      bind(b, draft, "cost", "Себестоимость, ₸", "number", false);
      bind(b, draft, "stock", "Остаток, шт.", "number", true);
      choice(
          b,
          draft,
          "status",
          "Публикация",
          new String[] {"active", "hidden"},
          new String[] {"Виден покупателям", "Скрыт"});
      bind(b, draft, "description", "Описание", "text", false);
      bind(b, draft, "key", "Ключевые характеристики — по одной на строку", "lines", false);
      EditText photo = bind(b, draft, "image", "Ссылка на фотографию", "image", false);
      action(
          b,
          "Выбрать фото на телефоне",
          false,
          () -> {
            photoField = photo;
            startActivityForResult(
                new Intent(Intent.ACTION_OPEN_DOCUMENT)
                    .setType("image/*")
                    .addCategory(Intent.CATEGORY_OPENABLE),
                51);
          });
      action(
          b,
          "Убрать фотографию",
          false,
          () -> {
            try {
              draft.put("image", "");
              photo.setText("");
              photo.setHint("Ссылка на фотографию");
              dirty = true;
            } catch (Exception ignored) {
            }
          });
      bind(b, draft, "warranty", "Гарантия", "text", false);
      LinearLayout specsHost = column(this);
      section(b, specsHost);
      JSONObject initial =
          draft.optJSONObject("specs") == null ? new JSONObject() : draft.optJSONObject("specs");
      renderSpecs(specsHost, initial, codes[cat.getSelectedItemPosition()]);
      cat.setOnItemSelectedListener(
          new AdapterView.OnItemSelectedListener() {
            boolean first = true;

            public void onItemSelected(AdapterView<?> p, View v, int pos, long id) {
              if (first) {
                first = false;
                return;
              }
              dirty = true;
              renderSpecs(specsHost, new JSONObject(), codes[pos]);
            }

            public void onNothingSelected(AdapterView<?> p) {}
          });
    } else if (kind.equals("categories")) {
      bind(b, draft, "name", "Название категории", "text", true);
      bind(b, draft, "description", "Описание", "text", false);
      bind(b, draft, "icon", "Значок категории", "text", false);
    } else if (kind.equals("reviews")) {
      bind(b, draft, "rating", "Оценка от 1 до 5", "number", true);
      bind(b, draft, "text", "Текст отзыва", "text", true);
      bind(b, draft, "reply", "Ответ магазина", "text", false);
    } else {
      bind(b, draft, "code", "Код промокода", "text", true);
      choice(
          b,
          draft,
          "type",
          "Скидка",
          new String[] {"percent", "fixed"},
          new String[] {"Процент", "Сумма, ₸"});
      bind(b, draft, "value", "Размер скидки", "number", true);
      bind(b, draft, "min", "Минимальная сумма заказа, ₸", "number", false);
      bind(b, draft, "description", "Описание", "text", false);
      toggle(b, draft, "active", "Промокод включён");
    }
    action(
        b,
        "Сохранить",
        true,
        () -> {
          if (!collect()) return;
          if (kind.equals("products") && !validImage(draft.optString("image"))) {
            feedback("Фотография должна быть ссылкой HTTPS или изображением с телефона.");
            return;
          }
          if (kind.equals("promos")
              && draft.optString("type").equals("percent")
              && draft.optLong("value") > 100) {
            feedback("Процент скидки не может превышать 100.");
            return;
          }
          if (kind.equals("reviews")) {
            if (draft.optInt("rating") < 1 || draft.optInt("rating") > 5) {
              feedback("Оценка должна быть от 1 до 5.");
              return;
            }
            command("updateReview", new JSONArray().put(draft.optString("id")).put(draft), kind);
            return;
          }
          command(
              kind.equals("products")
                  ? "saveProduct"
                  : kind.equals("categories") ? "saveCategory" : "savePromo",
              new JSONArray().put(draft),
              kind);
        });
    action(b, "Отмена", false, () -> navigate(kind, ""));
    dirty = false;
  }

  private static boolean validImage(String value) {
    return value.isEmpty()
        || value.startsWith("https://")
        || value.startsWith("data:image/jpeg;base64,")
        || value.startsWith("data:image/png;base64,");
  }

  private JSONObject currentSpecs;

  private void renderSpecs(LinearLayout b, JSONObject specs, String category) {
    if (currentSpecs != null) fields.removeIf(f -> f.target == currentSpecs);
    currentSpecs = specs;
    try {
      draft.put("specs", specs);
    } catch (Exception ignored) {
    }
    b.removeAllViews();
    section(b, text(this, "Характеристики", 20, TEXT, true));
    LinkedHashSet<String> keys = new LinkedHashSet<>();
    Iterator<String> it = specs.keys();
    while (it.hasNext()) keys.add(it.next());
    String defaults;
    switch (category) {
      case "cpu":
        defaults = "socket,tdp,igpu,unlocked,cores,threads,score";
        break;
      case "motherboard":
        defaults = "socket,chipset,ramType,ramSlots,maxRam,formFactor,m2";
        break;
      case "gpu":
        defaults = "tdp,length,recommendedPsu,vram,score";
        break;
      case "ram":
        defaults = "type,capacity,modules,speed,rgb";
        break;
      case "storage":
        defaults = "capacity,formFactor,interface,score";
        break;
      case "psu":
        defaults = "wattage,formFactor";
        break;
      case "case":
        defaults = "formFactors,maxGpuLength,maxCoolerHeight,psuFormFactor,radiator,fans";
        break;
      case "cooling":
        defaults = "type,height,tdpRating,sockets,radiator";
        break;
      case "monitor":
        defaults = "resolution,refresh,diagonal,matrix";
        break;
      case "peripherals":
        defaults = "kind,connection";
        break;
      default:
        defaults = "";
    }
    if (!defaults.isEmpty()) keys.addAll(Arrays.asList(defaults.split(",")));
    for (String k : keys) {
      Object value = specs.opt(k);
      if (value instanceof Boolean || Arrays.asList("igpu", "unlocked", "rgb").contains(k))
        toggle(b, specs, k, specLabel(k));
      else if (value instanceof JSONArray || Arrays.asList("formFactors", "sockets").contains(k))
        bind(b, specs, k, specLabel(k) + " — по одному на строку", "lines", false);
      else if (Arrays.asList("kind", "type", "ramType", "formFactor", "psuFormFactor")
          .contains(k)) {
        String[] values =
            k.equals("kind")
                ? new String[] {"keyboard", "mouse", "headset"}
                : k.equals("type") && category.equals("cooling")
                    ? new String[] {"air", "liquid"}
                    : k.equals("ramType") || k.equals("type") && category.equals("ram")
                        ? new String[] {"DDR4", "DDR5"}
                        : null;
        if (values != null) choice(b, specs, k, specLabel(k), values, values);
        else bind(b, specs, k, specLabel(k), "text", false);
      } else
        bind(
            b,
            specs,
            k,
            specLabel(k),
            value instanceof Number
                    || Arrays.asList(
                            "tdp",
                            "cores",
                            "threads",
                            "score",
                            "ramSlots",
                            "maxRam",
                            "m2",
                            "length",
                            "recommendedPsu",
                            "vram",
                            "modules",
                            "speed",
                            "wattage",
                            "maxGpuLength",
                            "maxCoolerHeight",
                            "height",
                            "tdpRating",
                            "refresh")
                        .contains(k)
                ? "decimal"
                : "text",
            false);
    }
  }

  private String specLabel(String k) {
    String[] keys = {
      "socket",
      "tdp",
      "igpu",
      "unlocked",
      "cores",
      "threads",
      "score",
      "chipset",
      "ramType",
      "ramSlots",
      "maxRam",
      "formFactor",
      "m2",
      "length",
      "recommendedPsu",
      "vram",
      "type",
      "capacity",
      "modules",
      "speed",
      "rgb",
      "interface",
      "wattage",
      "formFactors",
      "maxGpuLength",
      "maxCoolerHeight",
      "psuFormFactor",
      "radiator",
      "fans",
      "height",
      "tdpRating",
      "sockets",
      "resolution",
      "refresh",
      "diagonal",
      "matrix",
      "kind",
      "connection"
    };
    String[] labels = {
      "Сокет",
      "TDP, Вт",
      "Встроенная графика",
      "Разблокированный множитель",
      "Ядер",
      "Потоков",
      "Оценка производительности",
      "Чипсет",
      "Тип памяти платы",
      "Слотов памяти",
      "Максимум памяти, ГБ",
      "Форм-фактор",
      "Разъёмов M.2",
      "Длина видеокарты, мм",
      "Рекомендуемый БП, Вт",
      "Видеопамять, ГБ",
      "Тип",
      "Объём",
      "Модулей",
      "Частота памяти, МГц",
      "RGB-подсветка",
      "Интерфейс",
      "Мощность, Вт",
      "Поддерживаемые форматы плат",
      "Максимальная длина GPU, мм",
      "Максимальная высота кулера, мм",
      "Формат блока питания",
      "Радиатор",
      "Вентиляторы",
      "Высота, мм",
      "Отвод тепла, Вт",
      "Поддерживаемые сокеты",
      "Разрешение",
      "Частота обновления, Гц",
      "Диагональ",
      "Матрица",
      "Тип устройства",
      "Подключение"
    };
    int i = Arrays.asList(keys).indexOf(k);
    return i < 0 ? k : labels[i];
  }

  private EditText photoField;

  @Override
  protected void onActivityResult(int request, int result, Intent data) {
    super.onActivityResult(request, result, data);
    if (request != 51
        || result != RESULT_OK
        || data == null
        || data.getData() == null
        || photoField == null) return;
    android.net.Uri uri = data.getData();
    task(
        () -> {
          android.graphics.BitmapFactory.Options bounds =
              new android.graphics.BitmapFactory.Options();
          bounds.inJustDecodeBounds = true;
          try (java.io.InputStream in = getContentResolver().openInputStream(uri)) {
            android.graphics.BitmapFactory.decodeStream(in, null, bounds);
          }
          if (bounds.outWidth <= 0 || bounds.outHeight <= 0)
            throw new Exception("Не удалось прочитать изображение");
          android.graphics.BitmapFactory.Options options =
              new android.graphics.BitmapFactory.Options();
          options.inSampleSize = 1;
          while (bounds.outWidth / options.inSampleSize > 1200
              || bounds.outHeight / options.inSampleSize > 1200) options.inSampleSize *= 2;
          android.graphics.Bitmap image;
          try (java.io.InputStream in = getContentResolver().openInputStream(uri)) {
            image = android.graphics.BitmapFactory.decodeStream(in, null, options);
          }
          if (image == null) throw new Exception("Не удалось открыть изображение");
          java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
          image.compress(android.graphics.Bitmap.CompressFormat.JPEG, 80, bytes);
          image.recycle();
          return "data:image/jpeg;base64,"
              + android.util.Base64.encodeToString(
                  bytes.toByteArray(), android.util.Base64.NO_WRAP);
        },
        value -> {
          try {
            draft.put("image", value);
          } catch (Exception ignored) {
          }
          photoField.setText("");
          photoField.setHint("Фото с телефона выбрано");
          dirty = true;
          feedback("Фото подготовлено. Нажмите «Сохранить», чтобы обновить товар.");
        });
  }

  private void settings(boolean ai) {
    editing = true;
    fields.clear();
    LinearLayout b = page();
    heading(
        b,
        ai ? "Настройки ИИ" : "Настройки магазина",
        "Изменения применяются ко всем приложениям ByteStore");
    JSONObject settings = store.state.optJSONObject("settings");
    if (settings == null) settings = new JSONObject();
    draft =
        copy(restoredDraft != null ? restoredDraft : ai ? settings.optJSONObject("ai") : settings);
    restoredDraft = null;
    if (ai) {
      toggle(b, draft, "enabled", "ИИ включён");
      bind(b, draft, "apiKey", "Ключ OpenRouter", "secret", false);
      toggle(b, draft, "useFallback", "Локальный подбор при недоступности ИИ");
      section(
          b,
          text(
              this,
              "Ключ хранится только в защищённых настройках сервера и не включается в приложение.",
              13,
              MUTED,
              false));
    } else {
      bind(b, draft, "storeName", "Название магазина", "text", false);
      bind(b, draft, "phone", "Телефон магазина", "text", false);
      bind(b, draft, "email", "E-mail магазина", "text", false);
      bind(b, draft, "deliveryCost", "Стоимость доставки, ₸", "number", true);
      bind(b, draft, "freeDeliveryFrom", "Бесплатная доставка от, ₸", "number", true);
      toggle(b, draft, "maintenance", "Технические работы: оформление заказов недоступно");
    }
    action(
        b,
        "Сохранить настройки",
        true,
        () -> {
          if (collect())
            confirm(
                "Применить настройки?",
                "Настройки изменятся на сайте и в приложениях покупателей.",
                "Применить",
                () ->
                    command(
                        ai ? "updateAiSettings" : "updateSettings",
                        new JSONArray().put(draft),
                        "more"));
        });
    action(b, "Отмена", false, () -> navigate("more", ""));
    dirty = false;
  }

  @Override
  public void onBackPressed() {
    if (pending) return;
    if (store.session == null) {
      super.onBackPressed();
      return;
    }
    if (route.equals("edit") || route.equals("detail")) navigate(owner, "");
    else if (!route.equals("dashboard")) navigate("dashboard", "");
    else super.onBackPressed();
  }

  @Override
  public Object onRetainNonConfigurationInstance() {
    for (Field f : fields)
      try {
        Object value =
            f.view instanceof EditText
                ? ((EditText) f.view).getText().toString()
                : f.type.equals("boolean")
                    ? ((CheckBox) f.view).isChecked()
                    : f.codes[((Spinner) f.view).getSelectedItemPosition()];
        if (f.type.equals("image")
            && value.toString().isEmpty()
            && f.target.optString(f.key).startsWith("data:image/"))
          value = f.target.optString(f.key);
        if (f.type.equals("lines")) {
          JSONArray a = new JSONArray();
          for (String line : value.toString().split("\n"))
            if (!line.trim().isEmpty()) a.put(line.trim());
          value = a;
        }
        f.target.put(f.key, value);
      } catch (Exception ignored) {
      }
    Retained r = new Retained();
    r.state = store.state;
    r.store = store;
    r.api = api;
    r.mutationUnknown = mutationUnknown;
    r.draft = editing ? draft : null;
    r.route = route;
    r.owner = owner;
    r.record = record;
    r.queries = new HashMap<>(queries);
    return r;
  }

  @Override
  protected void onSaveInstanceState(Bundle state) {
    state.putString("route", editing ? owner : route);
    state.putString("record", record);
    super.onSaveInstanceState(state);
  }

  @Override
  protected void onDestroy() {
    generation++;
    worker.shutdown();
    super.onDestroy();
  }
}
