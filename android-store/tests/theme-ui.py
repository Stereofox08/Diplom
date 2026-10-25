#!/usr/bin/env python3
"""Verify native theme switching and persistence. Leaves user's requested dark theme selected."""
import subprocess,xml.etree.ElementTree as ET,re,time

def adb(*args):return subprocess.run(['adb',*args],check=True,capture_output=True,text=True,timeout=25).stdout

def ui():
 adb('shell','uiautomator','dump','/data/local/tmp/bytestore-theme-ui.xml')
 return list(ET.fromstring(adb('shell','cat','/data/local/tmp/bytestore-theme-ui.xml')).iter('node'))

def tap(label):
 for n in ui():
  if n.get('text','').lower()==label.lower() or n.get('content-desc')==label:
   a,b,c,d=map(int,re.findall(r'\d+',n.get('bounds')));adb('shell','input','tap',str((a+c)//2),str((b+d)//2));time.sleep(.7);return
 raise AssertionError('Missing control '+label)

def choose(label):
 tap('Профиль')
 for i in range(5):
  if any(n.get('text')=='Настройки' or n.get('content-desc')=='Настройки'for n in ui()):break
  adb('shell','input','swipe','710','2350','710','1350','500');time.sleep(.3)
 tap('Настройки');tap('Тема оформления');tap(label)

def saved():return adb('shell','run-as','kz.bytestore.shop','cat','shared_prefs/appearance.xml')
def shot(name):
 with open('/tmp/bytestore-mobile-theme-'+name+'.png','wb')as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
adb('shell','am','start','-n','kz.bytestore.shop/.MainActivity')
choose('Тёмная');assert '>dark<'in saved();shot('dark')
adb('shell','am','force-stop','kz.bytestore.shop');adb('shell','am','start','-n','kz.bytestore.shop/.MainActivity');time.sleep(.7);assert '>dark<'in saved();shot('dark-restart')
choose('Светлая');assert '>light<'in saved();shot('light')
choose('Как на устройстве');assert '>system<'in saved();shot('system')
choose('Тёмная');assert '>dark<'in saved();tap('Главная');shot('dark-home')
print('PASS native light/dark/system themes, settings selection and persistence after process restart. Dark selected. No basket/account/order writes.')
