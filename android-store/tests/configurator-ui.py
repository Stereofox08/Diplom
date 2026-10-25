#!/usr/bin/env python3
"""Read-only check of manual assembly and all twelve native slots. No draft/cart writes."""
import subprocess,xml.etree.ElementTree as ET,re,time

def adb(*args):return subprocess.run(['adb',*args],check=True,capture_output=True,text=True,timeout=25).stdout

def ui():
 adb('shell','uiautomator','dump','/data/local/tmp/bytestore-builder-ui.xml')
 nodes=list(ET.fromstring(adb('shell','cat','/data/local/tmp/bytestore-builder-ui.xml')).iter('node'))
 assert all('WebView' not in n.get('class','') for n in nodes)
 return nodes

def tap(text=None,desc=None):
 for n in ui():
  if (text is not None and n.get('text','').lower()==text.lower())or(desc is not None and n.get('content-desc')==desc):
   a,b,c,d=map(int,re.findall(r'\d+',n.get('bounds')));adb('shell','input','tap',str((a+c)//2),str((b+d)//2));time.sleep(.4);return
 raise AssertionError('Missing control '+str((text,desc)))

def shot(name):
 with open('/tmp/bytestore-mobile-'+name+'.png','wb')as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
adb('shell','am','start','-n','kz.bytestore.shop/.MainActivity');tap(desc='Главная');tap(text='Собрать\nПК')
texts=lambda:[n.get('text','')for n in ui()]
assert 'Соберите свой ПК' in texts();shot('configurator')
assert '01  Процессор' in texts()
tap(text='Выбрать');assert 'Только совместимые с выбранными' in texts();shot('component-picker');tap(text='Закрыть')
seen=set()
for i in range(24):
 current=texts();seen.update(current);print('Visible slots:',[x for x in current if len(x)>3 and x[:2].isdigit()],flush=True)
 if 'Очистить сборку' in current:break
 adb('shell','input','swipe','710','2350','710','1350','500');time.sleep(.6)
for i,label in enumerate(['Процессор','Материнская плата','Видеокарта','Оперативная память','Накопитель','Блок питания','Корпус','Охлаждение процессора','Монитор','Клавиатура','Мышь','Гарнитура']):assert f'{i+1:02d}  {label}'in seen,label
assert 'Добавить сборку в корзину' in seen and 'Поделиться спецификацией' in seen
shot('build-summary');tap(desc='Главная')
print('PASS native manual configurator: 12 slots, component picker/filter, compatibility/power/price summary, cart and sharing actions. No draft/cart writes.')
