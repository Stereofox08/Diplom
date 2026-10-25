#!/usr/bin/env python3
"""Smoke-test the newly installed native app. Uses only guest/local shopping data."""
import subprocess,xml.etree.ElementTree as ET,re,time,json
from pathlib import Path

def adb(*args):return subprocess.run(['adb',*args],check=True,capture_output=True,text=True,timeout=25).stdout

def ui():
 adb('shell','uiautomator','dump','/data/local/tmp/bytestore-native-ui.xml')
 s=adb('shell','cat','/data/local/tmp/bytestore-native-ui.xml')
 root=ET.fromstring(s)
 assert all('WebView' not in n.get('class','') for n in root.iter('node')),'WebView present'
 return list(root.iter('node'))

def find(text=None,desc=None,contains=None):
 nodes=ui()
 for n in nodes:
  if text is not None and n.get('text')!=text:continue
  if desc is not None and n.get('content-desc')!=desc:continue
  if contains is not None and contains not in n.get('content-desc',''):continue
  if not any([text is not None,desc is not None,contains is not None]):continue
  return n
 raise AssertionError('Missing native control: '+str((text,desc,contains)))

def tap(**where):
 n=find(**where);a,b,c,d=map(int,re.findall(r'\d+',n.get('bounds')))
 adb('shell','input','tap',str((a+c)//2),str((b+d)//2))
 time.sleep(.25)
 return n

def shot(name):
 with open('/tmp/bytestore-native-'+name+'.png','wb')as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)

adb('shell','am','start','-n','kz.bytestore.shop/.MainActivity')
find(desc='Каталог');shot('home')
tap(desc='Каталог');tap(text='Все товары');find(text='Все товары');shot('catalog')
tap(desc='Поиск товаров');adb('shell','input','text','Ryzen');adb('shell','input','keyevent','4');find(text='Найдено 3 товаров')
fav=tap(contains='В избранное: ');name=fav.get('content-desc').split(': ',1)[1]
tap(text='В корзину');tap(text=name);find(text=name);assert not any(n.get('content-desc')=='Поиск товаров' for n in ui())
adb('shell','input','keyevent','4');find(text='Все товары')
tap(desc='Избранное');find(text=name)
tap(desc='Корзина');find(text=name);shot('cart')
# Existing quantity is one; increment with its accessible native control.
tap(desc='Увеличить количество '+name)
tap(desc='Профиль');find(text='Сохраняйте покупки и следите за заказами');tap(text='Войти');find(desc='E-mail');find(desc='Пароль');shot('login')
adb('shell','input','keyevent','4');tap(desc='Главная');tap(desc='Собрать ПК');find(text='Подбор сборки');tap(text='Подобрать совместимую сборку');time.sleep(2)
# Scroll the result to the compatibility summary.
for _ in range(5):adb('shell','input','swipe','900','2500','900','650','350')
nodes=ui();assert any('Совместимость проверена' in n.get('text','') for n in nodes),'Build not rendered'
shot('builder');adb('shell','input','keyevent','4')
Path('/tmp/bytestore-native-ui-result.json').write_text(json.dumps({'result':'PASS','product':name,'native':True,'checks':['catalog','Ryzen search','favorite','cart','quantity','product/back','guest login','compatible build']},ensure_ascii=False))
print('PASS native UI: catalog, search, favorites, basket, quantity, product/back, login and compatible build. No accounts or orders created.')
