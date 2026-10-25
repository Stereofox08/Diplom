#!/usr/bin/env python3
"""Read-only native screen/navigation checks for the mobile storefront."""
import subprocess,xml.etree.ElementTree as ET,re,time

def adb(*args):return subprocess.run(['adb',*args],check=True,capture_output=True,text=True,timeout=25).stdout

def ui():
 adb('shell','uiautomator','dump','/data/local/tmp/bytestore-design-ui.xml')
 nodes=list(ET.fromstring(adb('shell','cat','/data/local/tmp/bytestore-design-ui.xml')).iter('node'))
 assert all('WebView' not in n.get('class','') for n in nodes)
 assert not any('Больше мощности' in n.get('text','') or 'Больше вашего' in n.get('text','') for n in nodes)
 return nodes

def tap(text=None,desc=None):
 for n in ui():
  if (text is not None and n.get('text')==text)or(desc is not None and n.get('content-desc')==desc):
   a,b,c,d=map(int,re.findall(r'\d+',n.get('bounds')));adb('shell','input','tap',str((a+c)//2),str((b+d)//2));time.sleep(.3);return
 raise AssertionError('Missing control '+str((text,desc)))

def has(text):return any(n.get('text')==text for n in ui())
def shot(name):
 with open('/tmp/bytestore-mobile-'+name+'.png','wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)

adb('shell','am','start','-n','kz.bytestore.shop/.MainActivity');tap(desc='Главная');assert has('Вам может понравиться');shot('home')
tap(desc='Каталог');assert has('Все товары') and has('Процессоры');shot('categories');tap(text='Видеокарты');assert has('Видеокарты');shot('products');adb('shell','input','keyevent','4');assert has('Процессоры')
tap(desc='Поиск товаров');adb('shell','input','text','Ryzen');adb('shell','input','keyevent','4');assert has('Найдено 3 товаров');shot('search');tap(desc='Главная');tap(desc='Профиль');assert has('Мои заказы') and has('Избранное') and has('Сравнение');shot('profile');tap(desc='Корзина');assert has('Корзина');shot('cart');tap(desc='Главная')
print('PASS native shopping design: search-first home, categories/list, products, grouped profile and cart; no website hero or WebView. No account/order writes.')
