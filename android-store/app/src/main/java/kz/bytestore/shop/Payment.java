package kz.bytestore.shop;

import java.util.Calendar;

final class Payment {
  static boolean validCard(String number) {
    if (!number.matches("\\d{13,19}") || number.matches("0+")) return false;
    int sum = 0;
    boolean twice = false;
    for (int i = number.length() - 1; i >= 0; i--) {
      int digit = number.charAt(i) - '0';
      if (twice) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      twice = !twice;
    }
    return sum % 10 == 0;
  }

  static boolean validExpiry(String value) {
    if (!value.matches("\\d{2}/\\d{2}")) return false;
    int month = Integer.parseInt(value.substring(0, 2)),
        year = 2000 + Integer.parseInt(value.substring(3));
    Calendar now = Calendar.getInstance();
    return month >= 1
        && month <= 12
        && (year > now.get(Calendar.YEAR)
            || year == now.get(Calendar.YEAR) && month >= now.get(Calendar.MONTH) + 1);
  }
}
