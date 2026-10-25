package kz.bytestore.shop;

import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONArray;
import org.json.JSONObject;

final class Store {
  private final SharedPreferences prefs;
  private final Cache cache;
  JSONObject state = new JSONObject();
  JSONObject session;
  String owner = "guest";
  final LinkedHashMap<String, Integer> cart = new LinkedHashMap<>();
  final LinkedHashSet<String> favorites = new LinkedHashSet<>(), compare = new LinkedHashSet<>();

  Store(Context context) {
    prefs = context.getSharedPreferences("store", Context.MODE_PRIVATE);
    cache = new Cache(context);
    try {
      String encrypted = prefs.getString("session", null);
      if (encrypted != null) session = new JSONObject(decrypt(encrypted));
    } catch (Exception ignored) {
      prefs.edit().remove("session").apply();
    }
    if (session != null && session.optJSONObject("user") != null)
      owner = session.optJSONObject("user").optString("id", "guest");
    else session = null;
    try {
      String local = cache.read();
      if (local == null) {
        try (InputStream in = context.getAssets().open("catalog.json")) {
          local = new String(Api.readAll(in), StandardCharsets.UTF_8);
        }
      }
      state = new JSONObject(local);
    } catch (Exception ignored) {
    }
    loadPersonal();
  }

  String city() {
    return prefs.getString("city", "Алматы");
  }

  void city(String value) {
    prefs.edit().putString("city", value).apply();
  }

  JSONArray array(String key) {
    return state.optJSONArray(key) == null ? new JSONArray() : state.optJSONArray(key);
  }

  JSONObject product(String id) {
    return find(array("products"), id);
  }

  JSONObject category(String id) {
    return find(array("categories"), id);
  }

  JSONObject profile() {
    if (session == null) return new JSONObject();
    JSONObject user = session.optJSONObject("user");
    JSONObject row = find(array("users"), user.optString("id"));
    if (row != null) return row;
    JSONObject meta = user.optJSONObject("user_metadata");
    return obj(
        "id",
        user.optString("id"),
        "email",
        user.optString("email"),
        "name",
        meta == null ? "Покупатель" : meta.optString("name", "Покупатель"),
        "phone",
        meta == null ? "" : meta.optString("phone"));
  }

  static JSONObject find(JSONArray array, String id) {
    for (int i = 0; i < array.length(); i++) {
      JSONObject p = array.optJSONObject(i);
      if (p != null && id.equals(p.optString("id"))) return p;
    }
    return null;
  }

  static JSONObject obj(Object... values) {
    JSONObject result = new JSONObject();
    try {
      for (int i = 0; i < values.length; i += 2) result.put((String) values[i], values[i + 1]);
    } catch (Exception e) {
      throw new IllegalArgumentException(e);
    }
    return result;
  }

  void applySnapshot(JSONObject value) {
    state = value;
  }

  void cachePublic(JSONObject value) {
    try {
      JSONObject settings = value.optJSONObject("settings");
      JSONArray publicProducts = new JSONArray();
      JSONArray products = value.optJSONArray("products");
      if (products != null)
        for (int i = 0; i < products.length(); i++) {
          JSONObject product = new JSONObject(products.getJSONObject(i).toString());
          product.remove("cost");
          publicProducts.put(product);
        }
      cache.write(
          obj(
                  "products",
                  publicProducts,
                  "categories",
                  value.optJSONArray("categories"),
                  "promos",
                  value.optJSONArray("promos"),
                  "settings",
                  obj(
                      "deliveryCost",
                      settings == null ? 2990 : settings.optLong("deliveryCost", 2990),
                      "freeDeliveryFrom",
                      settings == null ? 250000 : settings.optLong("freeDeliveryFrom", 250000)))
              .toString());
    } catch (Exception ignored) {
    }
  }

  synchronized void saveSession(JSONObject value) throws Exception {
    session = value;
    if (value == null) prefs.edit().remove("session").apply();
    else prefs.edit().putString("session", encrypt(value.toString())).apply();
  }

  void changeOwner(boolean transferGuest) {
    LinkedHashMap<String, Integer> old = new LinkedHashMap<>(cart);
    Set<String> oldFavorites = new LinkedHashSet<>(favorites);
    String before = owner;
    owner = session == null ? "guest" : session.optJSONObject("user").optString("id", "guest");
    loadPersonal();
    if (transferGuest && before.equals("guest") && !owner.equals("guest")) {
      for (Map.Entry<String, Integer> e : old.entrySet()) {
        JSONObject p = product(e.getKey());
        if (p != null)
          cart.put(
              e.getKey(),
              Math.min(p.optInt("stock"), cart.getOrDefault(e.getKey(), 0) + e.getValue()));
      }
      favorites.addAll(oldFavorites);
      savePersonal();
      prefs.edit().remove("cart_guest").remove("favorites_guest").apply();
    }
  }

  private void loadPersonal() {
    cart.clear();
    favorites.clear();
    try {
      JSONObject items = new JSONObject(prefs.getString("cart_" + owner, "{}"));
      Iterator<String> keys = items.keys();
      while (keys.hasNext()) {
        String id = keys.next();
        if (items.optInt(id) > 0) cart.put(id, items.optInt(id));
      }
      JSONArray fav = new JSONArray(prefs.getString("favorites_" + owner, "[]"));
      for (int i = 0; i < fav.length(); i++) favorites.add(fav.getString(i));
    } catch (Exception ignored) {
    }
  }

  void savePersonal() {
    JSONObject items = new JSONObject(cart);
    prefs
        .edit()
        .putString("cart_" + owner, items.toString())
        .putString("favorites_" + owner, new JSONArray(favorites).toString())
        .apply();
  }

  boolean add(String id) {
    JSONObject p = product(id);
    int quantity = cart.getOrDefault(id, 0);
    if (p == null
        || quantity >= p.optInt("stock")
        || !"active".equals(p.optString("status", "active"))) return false;
    cart.put(id, quantity + 1);
    basketChanged();
    return true;
  }

  void quantity(String id, int value) {
    JSONObject p = product(id);
    if (value <= 0) cart.remove(id);
    else if (p != null) {
      int quantity = Math.min(value, p.optInt("stock"));
      if (quantity > 0) cart.put(id, quantity);
      else cart.remove(id);
    }
    basketChanged();
  }

  void basketChanged() {
    prefs.edit().remove("checkout_" + owner).apply();
    savePersonal();
  }

  int count() {
    int n = 0;
    for (int q : cart.values()) n += q;
    return n;
  }

  void favorite(String id) {
    if (!favorites.remove(id)) favorites.add(id);
    savePersonal();
  }

  long subtotal() {
    long sum = 0;
    for (Map.Entry<String, Integer> e : cart.entrySet()) {
      JSONObject p = product(e.getKey());
      if (p != null) sum += p.optLong("price") * e.getValue();
    }
    return sum;
  }

  long discount(String code) {
    JSONObject p = promo(code);
    long sum = subtotal();
    if (p == null || sum < p.optLong("min")) return 0;
    return Math.min(
        sum,
        "percent".equals(p.optString("type"))
            ? Math.round(sum * p.optDouble("value") / 100)
            : p.optLong("value"));
  }

  JSONObject promo(String code) {
    if (code == null || code.trim().isEmpty()) return null;
    JSONArray promos = array("promos");
    for (int i = 0; i < promos.length(); i++) {
      JSONObject p = promos.optJSONObject(i);
      if (p != null && p.optBoolean("active") && code.trim().equalsIgnoreCase(p.optString("code")))
        return p;
    }
    return null;
  }

  long delivery(String code) {
    JSONObject settings = state.optJSONObject("settings");
    return subtotal() - discount(code)
            >= (settings == null ? 250000 : settings.optLong("freeDeliveryFrom", 250000))
        ? 0
        : (settings == null ? 2990 : settings.optLong("deliveryCost", 2990));
  }

  long total(String code) {
    return subtotal() - discount(code) + delivery(code);
  }

  JSONArray lines() {
    JSONArray result = new JSONArray();
    for (Map.Entry<String, Integer> e : cart.entrySet())
      result.put(obj("productId", e.getKey(), "qty", e.getValue()));
    return result;
  }

  String checkoutId() {
    String id = prefs.getString("checkout_" + owner, null);
    if (id == null) {
      id = UUID.randomUUID().toString();
      prefs.edit().putString("checkout_" + owner, id).apply();
    }
    return id;
  }

  void clearCart() {
    cart.clear();
    basketChanged();
  }

  private SecretKey key() throws Exception {
    KeyStore store = KeyStore.getInstance("AndroidKeyStore");
    store.load(null);
    if (store.containsAlias("bytestore_session"))
      return (SecretKey) store.getKey("bytestore_session", null);
    KeyGenerator generator =
        KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    generator.init(
        new KeyGenParameterSpec.Builder(
                "bytestore_session", KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build());
    return generator.generateKey();
  }

  private String encrypt(String value) throws Exception {
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, key());
    return Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
        + ":"
        + Base64.encodeToString(
            cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
  }

  private String decrypt(String value) throws Exception {
    String[] parts = value.split(":");
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(
        Cipher.DECRYPT_MODE,
        key(),
        new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
    return new String(
        cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
  }

  private static final class Cache extends SQLiteOpenHelper {
    Cache(Context c) {
      super(c, "catalog.db", null, 1);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
      db.execSQL("CREATE TABLE cache (id INTEGER PRIMARY KEY, data TEXT NOT NULL)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {}

    synchronized String read() {
      try (Cursor c = getReadableDatabase().rawQuery("SELECT data FROM cache WHERE id=1", null)) {
        return c.moveToFirst() ? c.getString(0) : null;
      }
    }

    synchronized void write(String value) {
      getWritableDatabase()
          .execSQL("INSERT OR REPLACE INTO cache(id,data) VALUES(1,?)", new Object[] {value});
    }
  }
}
