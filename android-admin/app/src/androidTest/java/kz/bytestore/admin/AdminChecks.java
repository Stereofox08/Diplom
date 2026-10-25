package kz.bytestore.admin;

import android.app.*;
import android.content.*;
import android.os.*;
import android.view.*;
import android.widget.*;
import java.lang.reflect.*;
import java.util.*;
import org.json.*;

public final class AdminChecks extends Instrumentation {
  MainActivity activity;
  FakeApi fake;
  Store isolated;

  @Override
  public void onCreate(Bundle args) {
    super.onCreate(args);
    start();
  }

  void check(boolean v, String label) {
    if (!v) throw new AssertionError(label);
  }

  Object invoke(String name, Class<?>[] types, Object... args) throws Exception {
    Method m = MainActivity.class.getDeclaredMethod(name, types);
    m.setAccessible(true);
    return m.invoke(activity, args);
  }

  void set(String field, Object value) throws Exception {
    Field f = MainActivity.class.getDeclaredField(field);
    f.setAccessible(true);
    f.set(activity, value);
  }

  Object get(String field) throws Exception {
    Field f = MainActivity.class.getDeclaredField(field);
    f.setAccessible(true);
    return f.get(activity);
  }

  void ui(Runnable work) throws Exception {
    final Throwable[] error = {null};
    runOnMainSync(
        () -> {
          try {
            work.run();
          } catch (Throwable e) {
            error[0] = e;
          }
        });
    if (error[0] != null) throw new Exception(error[0]);
  }

  void go(String route, String id) throws Exception {
    ui(
        () -> {
          try {
            invoke("go", new Class[] {String.class, String.class}, route, id);
          } catch (Exception e) {
            throw new RuntimeException(e);
          }
        });
    waitForIdleSync();
  }

  View find(View v, String label) {
    if (v instanceof TextView && ((TextView) v).getText().toString().equals(label)) return v;
    if (v instanceof ViewGroup) {
      ViewGroup g = (ViewGroup) v;
      for (int i = 0; i < g.getChildCount(); i++) {
        View found = find(g.getChildAt(i), label);
        if (found != null) return found;
      }
    }
    return null;
  }

  void tap(String text) throws Exception {
    ui(
        () -> {
          View b = find(activity.findViewById(android.R.id.content), text);
          check(b != null, "Missing action " + text);
          b.performClick();
        });
  }

  void field(String key, String value) throws Exception {
    ui(
        () -> {
          try {
            List<?> fields = (List<?>) get("fields");
            for (Object item : fields) {
              Field k = item.getClass().getDeclaredField("key");
              k.setAccessible(true);
              if (key.equals(k.get(item))) {
                Field v = item.getClass().getDeclaredField("view");
                v.setAccessible(true);
                ((EditText) v.get(item)).setText(value);
                return;
              }
            }
            throw new AssertionError("Missing field " + key);
          } catch (Exception e) {
            throw new RuntimeException(e);
          }
        });
  }

  void idle() throws Exception {
    for (int i = 0; i < 100; i++) {
      Thread.sleep(80);
      final boolean[] pending = {false};
      ui(
          () -> {
            try {
              pending[0] = (boolean) get("pending");
            } catch (Exception e) {
              throw new RuntimeException(e);
            }
          });
      if (!pending[0]) {
        Thread.sleep(80);
        waitForIdleSync();
        return;
      }
    }
    throw new AssertionError("Busy state never completed");
  }

  int webViews(View v) {
    int n = v.getClass().getName().contains("WebView") ? 1 : 0;
    if (v instanceof ViewGroup) {
      ViewGroup g = (ViewGroup) v;
      for (int i = 0; i < g.getChildCount(); i++) n += webViews(g.getChildAt(i));
    }
    return n;
  }

  void shot(String name) throws Exception {
    ui(
        () -> {
          try {
            View v = activity.findViewById(android.R.id.content);
            android.graphics.Bitmap b =
                android.graphics.Bitmap.createBitmap(
                    v.getWidth(), v.getHeight(), android.graphics.Bitmap.Config.ARGB_8888);
            v.draw(new android.graphics.Canvas(b));
            try (java.io.FileOutputStream out =
                new java.io.FileOutputStream(
                    new java.io.File(activity.getCacheDir(), "admin-" + name + ".png"))) {
              b.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out);
            }
            b.recycle();
          } catch (Exception e) {
            throw new RuntimeException(e);
          }
        });
  }

  @Override
  public void onStart() {
    Bundle results = new Bundle();
    Context context = getTargetContext().createDeviceProtectedStorageContext();
    Api live = null;
    try {
      check(
          getTargetContext().getPackageName().equals("kz.bytestore.admin"),
          "Admin package must be isolated");
      isolated = new Store(context);
      isolated.saveSession(null);
      live = new Api(isolated);
      JSONObject anonymous = live.snapshot();
      check(!anonymous.optBoolean("isAdmin"), "Anonymous granted staff access");
      boolean denied = false;
      try {
        MainActivity.requireAdmin(anonymous);
      } catch (Api.Failure e) {
        denied = e.status == 403;
      }
      check(denied, "Shopper snapshot passed admin gate");
      denied = false;
      try {
        live.request(
            "/rest/v1/rpc/store_command",
            Store.obj("op", "saveProduct", "args", new JSONArray()),
            true);
      } catch (Api.Failure e) {
        denied = true;
      }
      check(denied, "Anonymous command allowed");
      java.io.File credentials =
          new java.io.File(getTargetContext().getFilesDir(), "staff-smoke.json");
      if (credentials.exists()) {
        JSONObject auth;
        try (java.io.FileInputStream in = new java.io.FileInputStream(credentials)) {
          auth =
              new JSONObject(new String(Api.readAll(in), java.nio.charset.StandardCharsets.UTF_8));
        }
        JSONObject token =
            live.request(
                "/auth/v1/token?grant_type=password",
                Store.obj("email", auth.getString("email"), "password", auth.getString("password")),
                false);
        live.setSession(token);
        JSONObject staff = live.snapshot();
        MainActivity.requireAdmin(staff);
        check(staff.getJSONArray("products").length() > 0, "No shared products for admin");
        check(staff.has("audit") && staff.has("users"), "Incomplete staff snapshot");
        check(
            !context
                .getSharedPreferences("staff_session", 0)
                .getString("session", "")
                .contains(token.getString("access_token")),
            "Session is plaintext");
        check(
            new Store(context)
                .session
                .getJSONObject("user")
                .getString("id")
                .equals(token.getJSONObject("user").getString("id")),
            "Encrypted session not restored");
        live.request("/auth/v1/logout?scope=local", new JSONObject(), true);
        isolated.saveSession(null);
        credentials.delete();
      } else throw new AssertionError("Read-only live staff credentials were not provided");
      JSONObject fixture;
      try (java.io.InputStream in = getContext().getAssets().open("catalog.json")) {
        fixture =
            new JSONObject(new String(Api.readAll(in), java.nio.charset.StandardCharsets.UTF_8));
      }
      fixture
          .put("isAdmin", true)
          .put(
              "users",
              new JSONArray()
                  .put(
                      Store.obj(
                          "id",
                          "test-customer",
                          "name",
                          "Покупатель для проверки",
                          "email",
                          "fixture@example.com",
                          "status",
                          "active")))
          .put("orders", new JSONArray())
          .put("audit", new JSONArray());
      isolated.state = fixture;
      isolated.session =
          Store.obj(
              "access_token",
              "fixture-token",
              "expires_at",
              System.currentTimeMillis() / 1000 + 3600);
      fake = new FakeApi(isolated, fixture);
      activity =
          (MainActivity)
              startActivitySync(
                  new Intent(getTargetContext(), MainActivity.class)
                      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
      ui(
          () -> {
            activity.store = isolated;
            activity.api = fake;
            try {
              invoke("render", new Class[] {});
            } catch (Exception e) {
              throw new RuntimeException(e);
            }
          });
      for (String screen :
          new String[] {
            "dashboard",
            "products",
            "orders",
            "users",
            "reviews",
            "categories",
            "promos",
            "images",
            "audit",
            "more",
            "settings",
            "ai"
          }) {
        go(screen, "");
        ui(
            () ->
                check(
                    webViews(activity.findViewById(android.R.id.content)) == 0,
                    "WebView in staff app"));
        if (Arrays.asList("dashboard", "products", "more").contains(screen)) shot(screen);
      }
      go("products", "");
      tap("Добавить");
      field("name", "Тестовая деталь — только локальный тест");
      field("price", "12345");
      field("stock", "7");
      int before = fake.calls;
      tap("Сохранить");
      idle();
      check(
          fake.calls == before + 1 && fake.lastOp.equals("saveProduct"),
          "Product create not dispatched");
      String id = fake.lastArgs.getJSONObject(0).getString("id");
      check(
          Store.find(isolated.array("products"), id) != null,
          "Saved product missing from owner list");
      ui(
          () -> {
            try {
              set("owner", "products");
            } catch (Exception e) {
              throw new RuntimeException(e);
            }
          });
      go("edit", id);
      field("price", "-1");
      before = fake.calls;
      tap("Сохранить");
      idle();
      check(fake.calls == before, "Invalid price reached server");
      field("price", "23456");
      fake.failure =
          new Api.Failure(409, "Товар изменился. Обновите данные и повторите сохранение.");
      tap("Сохранить");
      idle();
      check((boolean) get("editing"), "Conflict discarded draft");
      check(((JSONObject) get("draft")).optLong("price") == 23456, "Conflict lost entered values");
      fake.failure = null;
      tap("Сохранить");
      idle();
      check(fake.lastArgs.getJSONObject(0).optLong("price") == 23456, "Edit value lost");
      ui(
          () -> {
            try {
              set("owner", "products");
            } catch (Exception e) {
              throw new RuntimeException(e);
            }
          });
      go("detail", id);
      fake.failure = new Exception("Связь прервалась после отправки запроса");
      ui(
          () -> {
            try {
              invoke(
                  "command",
                  new Class[] {String.class, JSONArray.class, String.class},
                  "duplicateProduct",
                  new JSONArray().put(id),
                  "products");
            } catch (Exception e) {
              throw new RuntimeException(e);
            }
          });
      idle();
      before = fake.calls;
      ui(
          () -> {
            try {
              invoke(
                  "command",
                  new Class[] {String.class, JSONArray.class, String.class},
                  "duplicateProduct",
                  new JSONArray().put(id),
                  "products");
            } catch (Exception e) {
              throw new RuntimeException(e);
            }
          });
      idle();
      check(fake.calls == before, "Uncertain operation retried before reconciliation");
      fake.failure = null;
      ui(
          () -> {
            try {
              invoke("refresh", new Class[] {});
            } catch (Exception e) {
              throw new RuntimeException(e);
            }
          });
      idle();
      check(!(boolean) get("mutationUnknown"), "Refresh did not reconcile unknown outcome");
      ui(
          () -> {
            try {
              invoke(
                  "command",
                  new Class[] {String.class, JSONArray.class, String.class},
                  "deleteProduct",
                  new JSONArray().put(id),
                  "products");
            } catch (Exception e) {
              throw new RuntimeException(e);
            }
          });
      idle();
      check(Store.find(isolated.array("products"), id) == null, "Delete did not update owner list");
      go("products", "");
      ui(() -> activity.finish());
      results.putString(
          "stream",
          "PASS: isolated native admin, real staff login/shared database, anonymous denial,"
              + " encrypted session, 12 native screens, fixture-only product CRUD, validation,"
              + " revision conflict, uncertain retry prevention and reconciliation. No live"
              + " catalogue/account/order mutations.");
      finish(Activity.RESULT_OK, results);
    } catch (Throwable e) {
      results.putString("stream", "FAIL: " + e);
      finish(Activity.RESULT_CANCELED, results);
    } finally {
      try {
        if (isolated != null) isolated.saveSession(null);
      } catch (Exception ignored) {
      }
      new java.io.File(getTargetContext().getFilesDir(), "staff-smoke.json").delete();
    }
  }

  static final class FakeApi extends Api {
    JSONObject data;
    int calls;
    String lastOp = "";
    JSONArray lastArgs;
    Exception failure;

    FakeApi(Store s, JSONObject data) {
      super(s);
      this.data = data;
    }

    @Override
    synchronized JSONObject request(String path, JSONObject body, boolean auth) throws Exception {
      if (path.contains("store_snapshot")) return data;
      if (path.contains("store_command")) {
        calls++;
        lastOp = body.getString("op");
        lastArgs = body.getJSONArray("args");
        if (failure != null) throw failure;
        JSONArray old = data.getJSONArray("products"), next = new JSONArray();
        if (lastOp.equals("saveProduct")) {
          JSONObject p = new JSONObject(lastArgs.getJSONObject(0).toString());
          boolean exists = false;
          for (int i = 0; i < old.length(); i++) {
            JSONObject item = old.getJSONObject(i);
            if (item.getString("id").equals(p.getString("id"))) {
              next.put(p);
              exists = true;
            } else next.put(item);
          }
          if (!exists) next.put(p);
          data.put("products", next);
        }
        if (lastOp.equals("deleteProduct")) {
          for (int i = 0; i < old.length(); i++)
            if (!old.getJSONObject(i).getString("id").equals(lastArgs.getString(0)))
              next.put(old.getJSONObject(i));
          data.put("products", next);
        }
      }
      return Store.obj("result", true);
    }
  }
}
