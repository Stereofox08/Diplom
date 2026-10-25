package kz.bytestore.admin;

import android.content.*;
import android.security.keystore.*;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import org.json.*;

/** No staff/customer records are cached on disk. Only this app's encrypted session. */
final class Store {
  private final SharedPreferences prefs;
  JSONObject session, state = new JSONObject();

  Store(Context c) {
    prefs = c.getSharedPreferences("staff_session", 0);
    try {
      String value = prefs.getString("session", null);
      if (value != null) session = new JSONObject(decrypt(value));
    } catch (Exception e) {
      prefs.edit().clear().apply();
    }
  }

  static JSONObject obj(Object... fields) {
    JSONObject o = new JSONObject();
    try {
      for (int i = 0; i < fields.length; i += 2) o.put((String) fields[i], fields[i + 1]);
    } catch (JSONException e) {
      throw new IllegalArgumentException(e);
    }
    return o;
  }

  JSONArray array(String name) {
    JSONArray a = state.optJSONArray(name);
    return a == null ? new JSONArray() : a;
  }

  static JSONObject find(JSONArray a, String id) {
    for (int i = 0; i < a.length(); i++) {
      JSONObject p = a.optJSONObject(i);
      if (p != null && id.equals(p.optString("id", p.optString("code")))) return p;
    }
    return null;
  }

  void saveSession(JSONObject value) throws Exception {
    if (value == null) {
      session = null;
      state = new JSONObject();
      prefs.edit().clear().commit();
      return;
    }
    String encrypted = encrypt(value.toString());
    prefs.edit().putString("session", encrypted).commit();
    session = value;
  }

  private SecretKey key() throws Exception {
    KeyStore k = KeyStore.getInstance("AndroidKeyStore");
    k.load(null);
    if (k.containsAlias("staff_session")) return (SecretKey) k.getKey("staff_session", null);
    KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    g.init(
        new KeyGenParameterSpec.Builder(
                "staff_session", KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build());
    return g.generateKey();
  }

  private String encrypt(String s) throws Exception {
    Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
    c.init(Cipher.ENCRYPT_MODE, key());
    return Base64.encodeToString(c.getIV(), Base64.NO_WRAP)
        + ":"
        + Base64.encodeToString(c.doFinal(s.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
  }

  private String decrypt(String s) throws Exception {
    String[] v = s.split(":");
    Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
    c.init(
        Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(v[0], Base64.NO_WRAP)));
    return new String(c.doFinal(Base64.decode(v[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
  }
}
