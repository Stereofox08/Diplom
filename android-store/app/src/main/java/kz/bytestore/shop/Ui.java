package kz.bytestore.shop;

import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.view.*;
import android.widget.*;
import java.text.NumberFormat;
import java.util.Locale;

final class Ui {
  static final int BG = BrandTokens.BG,
      SURFACE = BrandTokens.SURFACE,
      PANEL = BrandTokens.PANEL,
      BORDER = BrandTokens.BORDER,
      TEXT = BrandTokens.TEXT,
      MUTED = BrandTokens.MUTED,
      ACCENT = BrandTokens.ACCENT,
      GREEN = BrandTokens.GREEN,
      RED = BrandTokens.RED;
  private static Typeface regular, medium, bold, display;

  static Typeface font(Context c, int weight) {
    try {
      if (regular == null) {
        regular =
            new Typeface.Builder(c.getAssets(), BrandTokens.BODY_FONT)
                .setFontVariationSettings("'wght' 400")
                .build();
        medium =
            new Typeface.Builder(c.getAssets(), BrandTokens.BODY_FONT)
                .setFontVariationSettings("'wght' 600")
                .build();
        bold =
            new Typeface.Builder(c.getAssets(), BrandTokens.BODY_FONT)
                .setFontVariationSettings("'wght' 700")
                .build();
      }
      return weight >= 700 ? bold : weight >= 600 ? medium : regular;
    } catch (Exception e) {
      return Typeface.create("sans-serif", weight >= 600 ? Typeface.BOLD : Typeface.NORMAL);
    }
  }

  static Typeface displayFont(Context c) {
    try {
      if (display == null)
        display =
            new Typeface.Builder(c.getAssets(), BrandTokens.DISPLAY_FONT)
                .setFontVariationSettings("'wght' 700")
                .build();
      return display;
    } catch (Exception e) {
      return font(c, 700);
    }
  }

  static int dp(Context c, float n) {
    return Math.round(n * c.getResources().getDisplayMetrics().density);
  }

  static String money(long n) {
    return NumberFormat.getIntegerInstance(new Locale("ru", "RU")).format(n) + " ₸";
  }

  static GradientDrawable background(Context c, int color, int radius) {
    GradientDrawable d = new GradientDrawable();
    d.setColor(color);
    d.setCornerRadius(
        dp(
            c,
            radius >= 14
                ? BrandTokens.CARD_RADIUS
                : radius >= 9 ? BrandTokens.CONTROL_RADIUS : radius));
    d.setStroke(dp(c, 1), BORDER);
    return d;
  }

  static TextView text(Context c, String value, int size, int color, boolean bold) {
    TextView t = new TextView(c);
    t.setText(value);
    t.setTextSize(size);
    t.setTextColor(color);
    t.setFontFeatureSettings("kern");
    t.setTypeface(size >= 18 ? displayFont(c) : font(c, bold ? 700 : 400));
    t.setLineSpacing(dp(c, 2), 1);
    return t;
  }

  static LinearLayout column(Context c) {
    LinearLayout v = new LinearLayout(c);
    v.setOrientation(LinearLayout.VERTICAL);
    return v;
  }

  static LinearLayout row(Context c) {
    LinearLayout v = new LinearLayout(c);
    v.setOrientation(LinearLayout.HORIZONTAL);
    v.setGravity(Gravity.CENTER_VERTICAL);
    return v;
  }

  static LinearLayout card(Context c) {
    LinearLayout v = column(c);
    v.setPadding(dp(c, 16), dp(c, 16), dp(c, 16), dp(c, 16));
    v.setBackground(background(c, SURFACE, 16));
    return v;
  }

  static Button button(Context c, String label, boolean primary) {
    Button b = new Button(c);
    b.setText(label);
    b.setAllCaps(false);
    b.setTextSize(14);
    b.setTypeface(font(c, 600));
    b.setTextColor(primary ? BG : TEXT);
    b.setMinHeight(dp(c, BrandTokens.CONTROL_HEIGHT));
    b.setMinimumHeight(dp(c, BrandTokens.CONTROL_HEIGHT));
    b.setPadding(dp(c, 12), dp(c, 4), dp(c, 12), dp(c, 4));
    int base = primary ? ACCENT : PANEL;
    android.graphics.drawable.StateListDrawable states =
        new android.graphics.drawable.StateListDrawable();
    GradientDrawable focused = background(c, base, BrandTokens.CONTROL_RADIUS);
    focused.setStroke(dp(c, 2), primary ? TEXT : ACCENT);
    states.addState(new int[] {android.R.attr.state_focused}, focused);
    states.addState(new int[] {}, background(c, base, BrandTokens.CONTROL_RADIUS));
    b.setBackground(
        new android.graphics.drawable.RippleDrawable(
            android.content.res.ColorStateList.valueOf((ACCENT & 0x00FFFFFF) | 0x33000000),
            states,
            null));
    b.setStateListAnimator(null);
    return b;
  }

  static EditText field(Context c, String hint, int type) {
    EditText e = new EditText(c);
    e.setTextSize(16);
    e.setTextColor(TEXT);
    e.setHintTextColor(MUTED);
    e.setHint(hint);
    e.setSingleLine(true);
    e.setInputType(type);
    e.setTypeface(font(c, 400));
    e.setPadding(dp(c, 14), dp(c, 12), dp(c, 14), dp(c, 12));
    android.graphics.drawable.StateListDrawable fieldStates =
        new android.graphics.drawable.StateListDrawable();
    GradientDrawable focusedField = background(c, PANEL, BrandTokens.CONTROL_RADIUS);
    focusedField.setStroke(dp(c, 2), ACCENT);
    fieldStates.addState(new int[] {android.R.attr.state_focused}, focusedField);
    fieldStates.addState(new int[] {}, background(c, PANEL, BrandTokens.CONTROL_RADIUS));
    e.setBackground(fieldStates);
    return e;
  }

  static void gap(LinearLayout v, int n) {
    v.addView(new View(v.getContext()), new LinearLayout.LayoutParams(1, dp(v.getContext(), n)));
  }

  static void add(LinearLayout parent, View child) {
    parent.addView(child, new LinearLayout.LayoutParams(-1, -2));
  }

  static void section(LinearLayout parent, View child) {
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
    p.bottomMargin = dp(parent.getContext(), 14);
    parent.addView(child, p);
  }

  static final class Art extends View {
    String category;
    boolean selected;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();

    Art(Context c, String category) {
      super(c);
      this.category = category;
      setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    @Override
    protected void onDraw(Canvas canvas) {
      super.onDraw(canvas);
      paint.setStyle(Paint.Style.FILL);
      paint.setColor(PANEL);
      canvas.drawRoundRect(
          0, 0, getWidth(), getHeight(), dp(getContext(), 12), dp(getContext(), 12), paint);
      paint.setColor((ACCENT & 0x00FFFFFF) | 0x12000000);
      canvas.drawCircle(getWidth() * .85f, getHeight() * .2f, getWidth() * .36f, paint);
      canvas.save();
      float scale = Math.min(getWidth() / 42f, getHeight() / 35f);
      canvas.translate(getWidth() / 2f - 12 * scale, getHeight() / 2f - 12 * scale);
      canvas.scale(scale, scale);
      paint.setStyle(Paint.Style.STROKE);
      paint.setStrokeWidth(1.5f);
      paint.setColor(ACCENT);
      paint.setStrokeCap(Paint.Cap.ROUND);
      path.reset();
      switch (category == null ? "cpu" : category) {
        case "gpu":
          canvas.drawRoundRect(1, 5, 23, 18, 2, 2, paint);
          canvas.drawCircle(8, 11.5f, 4, paint);
          canvas.drawCircle(17, 11.5f, 4, paint);
          canvas.drawLine(4, 21, 20, 21, paint);
          break;
        case "ram":
          canvas.drawRoundRect(1, 7, 23, 17, 1, 1, paint);
          for (int x = 4; x < 22; x += 5) canvas.drawRect(x, 9, x + 3, 14, paint);
          for (int x = 4; x < 22; x += 3) canvas.drawLine(x, 17, x, 20, paint);
          break;
        case "storage":
          canvas.drawRoundRect(1, 7, 23, 17, 2, 2, paint);
          canvas.drawRect(4, 9, 10, 15, paint);
          canvas.drawLine(13, 10, 20, 10, paint);
          canvas.drawLine(13, 14, 18, 14, paint);
          break;
        case "case":
        case "prebuilt":
          canvas.drawRoundRect(4, 1, 20, 23, 2, 2, paint);
          canvas.drawLine(14, 1, 14, 23, paint);
          for (int y = 6; y < 21; y += 6) canvas.drawCircle(17, y, 2, paint);
          canvas.drawRect(7, 5, 11, 16, paint);
          break;
        case "monitor":
          canvas.drawRoundRect(1, 3, 23, 18, 1, 1, paint);
          canvas.drawLine(12, 18, 12, 22, paint);
          canvas.drawLine(6, 22, 18, 22, paint);
          break;
        case "cooling":
        case "psu":
          canvas.drawRoundRect(2, 2, 22, 22, 2, 2, paint);
          canvas.drawCircle(12, 12, 7, paint);
          canvas.drawCircle(12, 12, 2, paint);
          for (int a = 0; a < 4; a++) {
            canvas.save();
            canvas.rotate(a * 90, 12, 12);
            canvas.drawLine(12, 5, 15, 9, paint);
            canvas.restore();
          }
          break;
        case "motherboard":
          canvas.drawRoundRect(3, 1, 21, 23, 1, 1, paint);
          canvas.drawRect(7, 6, 15, 14, paint);
          canvas.drawLine(17, 4, 17, 16, paint);
          canvas.drawLine(6, 18, 17, 18, paint);
          canvas.drawLine(6, 21, 17, 21, paint);
          break;
        case "peripherals":
          canvas.drawRoundRect(1, 6, 23, 19, 2, 2, paint);
          for (int x = 4; x < 22; x += 4)
            for (int y = 9; y < 16; y += 4) canvas.drawPoint(x, y, paint);
          canvas.drawLine(8, 17, 16, 17, paint);
          break;
        default:
          canvas.drawRoundRect(5, 5, 19, 19, 2, 2, paint);
          canvas.drawRect(9, 9, 15, 15, paint);
          for (int x = 8; x < 19; x += 4) {
            canvas.drawLine(x, 2, x, 5, paint);
            canvas.drawLine(x, 19, x, 22, paint);
            canvas.drawLine(2, x, 5, x, paint);
            canvas.drawLine(19, x, 22, x, paint);
          }
          break;
      }
      canvas.restore();
    }
  }

  static final class EmptyCart extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();

    EmptyCart(Context context) {
      super(context);
      setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    @Override
    protected void onDraw(Canvas c) {
      super.onDraw(c);
      c.save();
      c.scale(getWidth() / 200f, getHeight() / 190f);
      paint.setStyle(Paint.Style.FILL);
      paint.setColor((ACCENT & 0x00FFFFFF) | 0x18000000);
      c.drawCircle(100, 88, 75, paint);
      paint.setColor((ACCENT & 0x00FFFFFF) | 0x32000000);
      c.drawOval(38, 169, 178, 183, paint);
      paint.setStyle(Paint.Style.STROKE);
      paint.setStrokeWidth(5);
      paint.setStrokeCap(Paint.Cap.ROUND);
      paint.setStrokeJoin(Paint.Join.ROUND);
      paint.setColor(ACCENT);
      path.reset();
      path.moveTo(22, 71);
      path.lineTo(40, 71);
      path.lineTo(60, 147);
      path.lineTo(163, 147);
      c.drawPath(path, paint);
      path.reset();
      path.moveTo(49, 95);
      path.lineTo(178, 95);
      path.lineTo(162, 131);
      path.lineTo(58, 131);
      c.drawPath(path, paint);
      c.drawLine(87, 100, 90, 127, paint);
      c.drawLine(121, 100, 119, 127, paint);
      c.drawLine(152, 100, 147, 127, paint);
      c.drawCircle(73, 165, 9, paint);
      c.drawCircle(151, 165, 9, paint);
      c.save();
      c.rotate(-12, 104, 63);
      paint.setStyle(Paint.Style.FILL);
      paint.setColor(PANEL);
      c.drawRoundRect(68, 26, 140, 98, 14, 14, paint);
      paint.setStyle(Paint.Style.STROKE);
      paint.setStrokeWidth(3.5f);
      paint.setColor(ACCENT);
      c.drawRoundRect(79, 37, 129, 87, 7, 7, paint);
      c.drawRect(94, 52, 114, 72, paint);
      for (int n = 88; n < 126; n += 12) {
        c.drawLine(n, 28, n, 37, paint);
        c.drawLine(n, 87, n, 96, paint);
        c.drawLine(70, n - 50, 79, n - 50, paint);
        c.drawLine(129, n - 50, 138, n - 50, paint);
      }
      c.restore();
      paint.setColor(ACCENT);
      c.drawLine(166, 38, 166, 54, paint);
      c.drawLine(158, 46, 174, 46, paint);
      c.drawCircle(40, 35, 3, paint);
      c.restore();
    }
  }

  static final class NavIcon extends View {
    private final int type;
    boolean active;
    int badge;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();

    NavIcon(Context c, int type) {
      super(c);
      this.type = type;
      setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    @Override
    protected void onDraw(Canvas c) {
      super.onDraw(c);
      c.save();
      c.scale(getWidth() / 24f, getHeight() / 24f);
      paint.setColor(active ? ACCENT : MUTED);
      paint.setStyle(Paint.Style.STROKE);
      paint.setStrokeWidth(1.65f);
      paint.setStrokeCap(Paint.Cap.ROUND);
      paint.setStrokeJoin(Paint.Join.ROUND);
      Path p = path;
      p.reset();
      if (type == 0) {
        p.moveTo(3, 10);
        p.lineTo(12, 3);
        p.lineTo(21, 10);
        p.lineTo(21, 21);
        p.lineTo(15, 21);
        p.lineTo(15, 14);
        p.lineTo(9, 14);
        p.lineTo(9, 21);
        p.lineTo(3, 21);
        p.close();
        c.drawPath(p, paint);
      } else if (type == 1) {
        for (int x = 3; x <= 14; x += 11)
          for (int y = 3; y <= 14; y += 11) c.drawRoundRect(x, y, x + 7, y + 7, 1.5f, 1.5f, paint);
      } else if (type == 2) {
        p.moveTo(12, 21);
        p.cubicTo(10, 19, 2, 13, 2, 8);
        p.cubicTo(2, 2, 9, 1, 12, 6);
        p.cubicTo(15, 1, 22, 2, 22, 8);
        p.cubicTo(22, 13, 14, 19, 12, 21);
        c.drawPath(p, paint);
      } else if (type == 3) {
        p.moveTo(2, 3);
        p.lineTo(5, 3);
        p.lineTo(8, 16);
        p.lineTo(19, 16);
        p.lineTo(22, 6);
        p.lineTo(6, 6);
        c.drawPath(p, paint);
        c.drawCircle(9, 21, 1, paint);
        c.drawCircle(18, 21, 1, paint);
      } else if (type == 4) {
        c.drawCircle(12, 7, 4, paint);
        c.drawArc(4, 13, 20, 29, 180, 180, false, paint);
      } else if (type == 5) {
        p.moveTo(3, 7);
        p.lineTo(12, 2);
        p.lineTo(21, 7);
        p.lineTo(21, 18);
        p.lineTo(12, 23);
        p.lineTo(3, 18);
        p.close();
        c.drawPath(p, paint);
        c.drawLine(3, 7, 12, 12, paint);
        c.drawLine(12, 12, 21, 7, paint);
        c.drawLine(12, 12, 12, 23, paint);
        c.drawLine(7.5f, 4.5f, 16.5f, 9.5f, paint);
      } else if (type == 6) {
        c.drawRoundRect(3, 2, 21, 17, 2, 2, paint);
        c.drawLine(8, 22, 16, 22, paint);
        c.drawLine(12, 17, 12, 22, paint);
        c.drawLine(12, 6, 12, 13, paint);
        c.drawLine(8.5f, 9.5f, 15.5f, 9.5f, paint);
      } else if (type == 7) {
        c.drawCircle(6, 6, 3, paint);
        c.drawCircle(18, 18, 3, paint);
        c.drawLine(4, 21, 20, 3, paint);
      } else if (type == 8) {
        p.moveTo(12, 23);
        p.cubicTo(8, 18, 4, 12, 4, 8);
        p.cubicTo(4, -1, 20, -1, 20, 8);
        p.cubicTo(20, 12, 16, 18, 12, 23);
        c.drawPath(p, paint);
        c.drawCircle(12, 8, 2.5f, paint);
      } else if (type == 9) {
        c.drawCircle(12, 12, 7, paint);
        c.drawCircle(12, 12, 2.5f, paint);
        for (int a = 0; a < 8; a++) {
          c.save();
          c.rotate(a * 45, 12, 12);
          c.drawLine(12, 2, 12, 5, paint);
          c.restore();
        }
      } else if (type == 10 || type == 11) {
        c.drawCircle(12, 12, 10, paint);
        if (type == 10) {
          c.drawArc(8, 6, 16, 13, 180, 270, false, paint);
          c.drawLine(12, 12, 12, 15, paint);
        } else {
          c.drawCircle(12, 7, 0.6f, paint);
          c.drawLine(12, 11, 12, 17, paint);
        }
        c.drawPoint(12, 18, paint);
      } else if (type == 12) {
        c.drawRoundRect(2, 3, 22, 18, 3, 3, paint);
        p.moveTo(6, 18);
        p.lineTo(6, 23);
        p.lineTo(12, 18);
        c.drawPath(p, paint);
        for (int x = 7; x <= 17; x += 5) c.drawPoint(x, 10, paint);
      } else if (type == 13) {
        c.drawRoundRect(2, 2, 22, 22, 3, 3, paint);
        c.drawLine(7, 17, 7, 11, paint);
        c.drawLine(12, 17, 12, 6, paint);
        c.drawLine(17, 17, 17, 9, paint);
      } else {
        p.moveTo(15, 4);
        p.lineTo(7, 12);
        p.lineTo(15, 20);
        c.drawPath(p, paint);
      }
      if (badge > 0) {
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(ACCENT);
        c.drawCircle(19, 5, 5, paint);
        paint.setColor(BG);
        paint.setTextSize(7);
        paint.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        paint.setTextAlign(Paint.Align.CENTER);
        c.drawText(badge > 9 ? "9+" : String.valueOf(badge), 19, 7.5f, paint);
      }
      c.restore();
    }
  }
}
