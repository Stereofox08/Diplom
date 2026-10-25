package kz.bytestore.shop;

import android.app.Instrumentation;
import android.content.Context;
import android.os.Bundle;
import android.os.SystemClock;
import java.util.*;
import org.json.JSONObject;

public final class NativeChecks extends Instrumentation {
  @Override
  public void onCreate(Bundle arguments) {
    super.onCreate(arguments);
    start();
  }

  private void check(boolean condition, String message) {
    if (!condition) throw new AssertionError(message);
  }

  private int[] buttons(android.view.View view) {
    int[] result = new int[3];
    if (view.getClass().getName().contains("WebView")) result[2]++;
    if (view instanceof android.widget.Button) {
      android.widget.Button b = (android.widget.Button) view;
      String label = b.getText().toString();
      if (label.equals("Проверяем…") || label.equals("Нет связи")) result[0]++;
      if (label.equals("В корзину") && b.isEnabled()) result[1]++;
    }
    if (view instanceof android.view.ViewGroup) {
      android.view.ViewGroup group = (android.view.ViewGroup) view;
      for (int i = 0; i < group.getChildCount(); i++) {
        int[] child = buttons(group.getChildAt(i));
        for (int j = 0; j < 3; j++) result[j] += child[j];
      }
    }
    return result;
  }

  @Override
  public void onStart() {
    Bundle results = new Bundle();
    Context isolated = getTargetContext().createDeviceProtectedStorageContext();
    try {
      check(
          Api.parseResponse("true").optBoolean("result"), "Scalar command acknowledgement failed");
      Store s = new Store(isolated);
      s.clearCart();
      s.favorites.clear();
      s.savePersonal();
      check(s.array("products").length() == 60, "Bundled catalog missing");
      String vectorsText;
      try (java.io.InputStream input = getContext().getAssets().open("configurator-parity.json")) {
        java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
        vectorsText = bytes.toString("UTF-8");
      }
      org.json.JSONArray vectors = new org.json.JSONArray(vectorsText);
      for (int i = 0; i < vectors.length(); i++) {
        JSONObject vector = vectors.getJSONObject(i), ids = vector.getJSONObject("ids");
        Map<String, JSONObject> draft = new LinkedHashMap<>();
        for (String slot : BuildRules.SLOTS)
          if (ids.has(slot)) draft.put(slot, s.product(ids.getString(slot)));
        BuildRules.Check c = BuildRules.check(draft);
        check(
            c.errors.size() == vector.getInt("errors"),
            "Web/native errors mismatch " + i + " " + ids);
        check(
            c.warnings.size() == vector.getInt("warnings"),
            "Web/native warnings mismatch " + i + " " + ids);
        check(
            c.notes.size() == vector.getInt("notes"), "Web/native notes mismatch " + i + " " + ids);
        check(
            c.peak == vector.getInt("peak")
                && c.minimum == vector.getInt("minimum")
                && c.recommended == vector.getInt("recommended"),
            "Web/native power mismatch " + i);
        check(
            c.total == vector.getLong("total") && c.fps == vector.getInt("fps"),
            "Web/native totals/FPS mismatch " + i);
      }
      results.putInt("configuratorParityVectors", vectors.length());
      check(Payment.validCard("4111111111111111"), "Valid card rejected");
      check(!Payment.validCard("4111111111111112"), "Bad checksum accepted");
      check(!Payment.validCard("0000000000000000"), "Zero card accepted");
      check(!Payment.validExpiry("00/99") && !Payment.validExpiry("12/00"), "Bad expiry accepted");
      check(Payment.validExpiry("12/39"), "Future expiry rejected");
      long begin = SystemClock.elapsedRealtime();
      List<JSONObject> build = BuildPicker.pick(s, 750000, 0);
      long duration = SystemClock.elapsedRealtime() - begin;
      check(build.size() == 8, "Complete compatible build not found");
      long sum = 0;
      Map<String, JSONObject> parts = new HashMap<>();
      for (JSONObject p : build) {
        sum += p.optLong("price");
        parts.put(p.optString("categoryId"), p);
        check(p.optInt("stock") > 0, "Out of stock component");
      }
      check(sum <= 750000, "Budget exceeded");
      check(
          parts
              .get("cpu")
              .getJSONObject("specs")
              .getString("socket")
              .equals(parts.get("motherboard").getJSONObject("specs").getString("socket")),
          "CPU socket mismatch");
      check(
          parts
              .get("ram")
              .getJSONObject("specs")
              .getString("type")
              .equals(parts.get("motherboard").getJSONObject("specs").getString("ramType")),
          "RAM generation mismatch");
      check(BuildPicker.pick(s, 10000, 0).isEmpty(), "Impossible budget produced build");
      JSONObject p = s.product("gpu-rtx4060");
      check(s.add(p.getString("id")), "Cart add failed");
      s.quantity(p.getString("id"), 2);
      check(s.count() == 2, "Cart quantity failed");
      long total = s.total("");
      check(
          total == p.getLong("price") * 2 + (p.getLong("price") * 2 >= 250000 ? 0 : 2990),
          "Cart total incorrect");
      check(s.discount("START5") == Math.round(s.subtotal() * .05), "Promo calculation incorrect");
      String request = s.checkoutId();
      check(request.equals(s.checkoutId()), "Idempotency key changed");
      s.quantity(p.getString("id"), 1);
      check(!request.equals(s.checkoutId()), "Basket edit retained old idempotency key");
      s.favorite(p.getString("id"));
      Store restored = new Store(isolated);
      check(
          restored.count() == 1 && restored.favorites.contains(p.getString("id")),
          "Local cart/favorites not restored");
      s.cachePublic(s.state);
      check(new Store(isolated).array("products").length() == 60, "SQLite cache failed");
      s.saveSession(
          Store.obj(
              "access_token",
              "native-check-placeholder",
              "refresh_token",
              "native-check-refresh",
              "expires_at",
              System.currentTimeMillis() / 1000 + 300,
              "user",
              Store.obj("id", "native-check-id")));
      check(
          !isolated
              .getSharedPreferences("store", 0)
              .getString("session", "")
              .contains("native-check-placeholder"),
          "Session stored in plaintext");
      check(
          new Store(isolated).session.getString("access_token").equals("native-check-placeholder"),
          "Encrypted session did not restore");
      s.saveSession(null);
      JSONObject live = new Api(s).snapshot();
      check(live.getJSONArray("products").length() == 60, "Native HTTPS snapshot failed");
      check(
          live.getJSONArray("users").length() == 0 && live.getJSONArray("orders").length() == 0,
          "Anonymous snapshot leaked personal data");
      MainActivity activity =
          (MainActivity)
              startActivitySync(
                  new android.content.Intent(getTargetContext(), MainActivity.class)
                      .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK));
      final boolean[] gates = new boolean[3];
      final String[] uiError = new String[1];
      runOnMainSync(
          () -> {
            try {
              java.lang.reflect.Field field = MainActivity.class.getDeclaredField("verifiedAt");
              field.setAccessible(true);
              java.lang.reflect.Method update = MainActivity.class.getDeclaredMethod("updateData");
              update.setAccessible(true);
              field.setLong(activity, 0);
              update.invoke(activity);
              int[] before = buttons(activity.findViewById(android.R.id.content));
              gates[0] = before[0] > 0 && before[1] == 0;
              field.setLong(activity, SystemClock.elapsedRealtime());
              update.invoke(activity);
              int[] after = buttons(activity.findViewById(android.R.id.content));
              gates[1] = after[1] > 0;
              gates[2] = after[2] == 0;
              android.content.SharedPreferences draftPrefs =
                  activity.getSharedPreferences("builder", 0);
              String originalDraft = draftPrefs.getString("draft", null);
              try {
                java.lang.reflect.Method save =
                    MainActivity.class.getDeclaredMethod("saveBuild", Map.class);
                java.lang.reflect.Method load = MainActivity.class.getDeclaredMethod("manualBuild");
                java.lang.reflect.Method renderBuild =
                    MainActivity.class.getDeclaredMethod("builder");
                save.setAccessible(true);
                load.setAccessible(true);
                renderBuild.setAccessible(true);
                Map<String, JSONObject> manual = new LinkedHashMap<>();
                for (JSONObject part : build) {
                  String cat = part.optString("categoryId");
                  manual.put(cat.equals("cooling") ? "cooler" : cat, part);
                }
                save.invoke(activity, manual);
                Map<?, ?> restoredBuild = (Map<?, ?>) load.invoke(activity);
                check(restoredBuild.size() == 8, "Manual draft lost selected components");
                check(
                    draftPrefs.getString("draft", "").contains(manual.get("cpu").optString("id")),
                    "Manual draft not persisted by product ID");
                renderBuild.invoke(activity);
                android.view.ViewGroup nativeRoot =
                    (android.view.ViewGroup) activity.findViewById(android.R.id.content);
                check(buttons(nativeRoot)[2] == 0, "Manual configurator contains WebView");
                manual.remove("gpu");
                save.invoke(activity, manual);
                check(
                    ((Map<?, ?>) load.invoke(activity)).size() == 7,
                    "Component removal not persisted");
                save.invoke(activity, new LinkedHashMap<String, JSONObject>());
                check(((Map<?, ?>) load.invoke(activity)).isEmpty(), "Manual reset failed");
              } finally {
                if (originalDraft == null) draftPrefs.edit().remove("draft").commit();
                else draftPrefs.edit().putString("draft", originalDraft).commit();
              }
              activity.finish();
            } catch (Throwable e) {
              uiError[0] = e.toString();
            }
          });
      check(uiError[0] == null, "Native UI check failed: " + uiError[0]);
      check(gates[0], "Purchase enabled before availability verification");
      check(gates[1], "Purchase not enabled after verification");
      check(gates[2], "Unexpected WebView in native app");
      results.putString(
          "stream",
          "PASS: 2061 web/native configurator rule vectors, manual draft persistence/removal/reset,"
              + " native UI stock gating/no WebView, catalog/HTTPS, SQLite, encrypted session,"
              + " local basket/favorites, promos, idempotency, card validation and compatible"
              + " 8-part build. Build selection "
              + duration
              + "ms. No orders/accounts created.");
      finish(android.app.Activity.RESULT_OK, results);
    } catch (Throwable error) {
      results.putString("stream", "FAIL: " + error);
      finish(android.app.Activity.RESULT_CANCELED, results);
    } finally {
      isolated.getSharedPreferences("store", 0).edit().clear().commit();
      isolated.deleteDatabase("catalog.db");
    }
  }
}
