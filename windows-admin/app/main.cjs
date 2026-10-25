const {app,BrowserWindow,Menu,dialog,ipcMain,shell,session}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises'),{pathToFileURL}=require('node:url');
const theme=require('./theme.json');
const store='https://stereofox08.github.io/Diplom/';
const entry=pathToFileURL(path.join(__dirname,'web','admin.html')).href;
const smoke=process.argv.includes('--smoke-test');
if(smoke)app.setPath('userData',path.join(app.getPath('temp'),'ByteStoreAdmin-Smoke-'+process.pid));
// Software rendering also works in virtual machines and CrossOver.
app.disableHardwareAcceleration();
let window;
function external(raw){try{const u=new URL(raw);if(u.protocol==='https:')shell.openExternal(u.href);}catch{}}
function command(name){window.webContents.send('admin-command',name);}
app.whenReady().then(async()=>{
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,done)=>done(false));
 session.defaultSession.setPermissionCheckHandler(()=>false);
 window=new BrowserWindow({title:'ByteStore Admin',width:1320,height:860,minWidth:900,minHeight:640,backgroundColor:theme.background,icon:path.join(__dirname,'icon.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,devTools:!app.isPackaged}});
 window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
 window.webContents.on('will-navigate',(event,url)=>{if(url!==entry){event.preventDefault();external(url);}});
 window.webContents.on('will-attach-webview',event=>event.preventDefault());
 ipcMain.handle('save-file',async(event,data)=>{
  if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!==entry)throw new Error('Invalid sender');
  if(!data||typeof data.name!=='string'||typeof data.content!=='string'||data.content.length>25*1024*1024)throw new Error('Invalid export');
  const name=path.basename(data.name).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_');
  const result=await dialog.showSaveDialog(window,{defaultPath:name});if(!result.canceled&&result.filePath)await fs.writeFile(result.filePath,data.content,'utf8');
  return !result.canceled;
 });
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'Файл',submenu:[{label:'Экспорт данных…',accelerator:'Ctrl+S',click:()=>command('backup')},{label:'Открыть магазин',accelerator:'Ctrl+O',click:()=>external(store)},{label:'Обновить данные',accelerator:'Ctrl+R',click:()=>command('refresh')},{label:'Выйти из аккаунта',accelerator:'Ctrl+L',click:()=>command('logout')},{type:'separator'},{role:'quit',label:'Закрыть'}]},
  {label:'Правка',submenu:[{role:'undo',label:'Отменить'},{role:'redo',label:'Повторить'},{type:'separator'},{role:'cut',label:'Вырезать'},{role:'copy',label:'Копировать'},{role:'paste',label:'Вставить'},{role:'selectAll',label:'Выделить всё'}]},
  {label:'Справка',submenu:[{label:'О программе',click:()=>dialog.showMessageBox(window,{message:'ByteStore Admin 0.3',detail:'Управление товарами, заказами и клиентами ByteStore. Для работы требуется интернет.'})}]}
 ]));
 await window.loadFile(path.join(__dirname,'web','admin.html'));
 if(smoke){
  const timer=setTimeout(()=>finish({ok:false,error:'Timeout'}),90000);
  try{
   await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let tries=0;const t=setInterval(()=>{if(window.BS&&BS.db.state){clearInterval(t);resolve(true);}else if(++tries>120){clearInterval(t);reject(new Error('Cloud did not load'));}},300);})`);
   const result=await window.webContents.executeJavaScript(`({cloud:!!BS.cloud,products:BS.db.productsAll().length,login:!!document.querySelector('[data-admin-login]'),bridge:typeof desktopBridge.saveFile,node:typeof window.require})`);
   if(process.env.BYTESTORE_SMOKE_CREDENTIALS){
    const accounts=JSON.parse(await fs.readFile(process.env.BYTESTORE_SMOKE_CREDENTIALS,'utf8'));const a=accounts.users.find(a=>a.admin);
    const login=await window.webContents.executeJavaScript(`BS.auth.login(${JSON.stringify(a.email)},${JSON.stringify(a.password)})`);
    if(!login.ok)throw new Error('Admin login failed');
    result.panels=await window.webContents.executeJavaScript(`(async()=>{BS.admin.init();let count=0;for(const id of ['dashboard','products','images','categories','orders','reviews','users','promos','ai','log']){BS.admin.show(id);await new Promise(r=>setTimeout(r,150));if(!BS.admin.panelHost.innerHTML.trim()||BS.admin.panelHost.querySelector('.loading-block'))throw new Error('Panel did not render: '+id);count++;}return count;})()`);
    await window.loadFile(path.join(__dirname,'web','admin.html'));
    result.persisted=await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let tries=0;const t=setInterval(()=>{if(window.BS&&BS.db.state){clearInterval(t);resolve(BS.db.isAdmin());}else if(++tries>120){clearInterval(t);reject(new Error('Session reload timeout'));}},300);})`);
    await window.webContents.executeJavaScript('BS.auth.logout()');
   }
   result.ok=result.cloud&&result.products>0&&result.login&&result.bridge==='function'&&result.node==='undefined'&&(!process.env.BYTESTORE_SMOKE_CREDENTIALS||(result.panels===10&&result.persisted));
   clearTimeout(timer);finish(result);
  }catch(e){clearTimeout(timer);finish({ok:false,error:e.message});}
 }
}).catch(error=>{if(smoke)finish({ok:false,error:error.message});else dialog.showErrorBox('ByteStore Admin',error.message);});
function finish(result){fs.writeFile(process.env.BYTESTORE_SMOKE_RESULT||path.join(app.getPath('temp'),'bytestore-windows-smoke.json'),JSON.stringify(result,null,2)).finally(()=>app.exit(result.ok?0:1));}
app.on('window-all-closed',()=>app.quit());
