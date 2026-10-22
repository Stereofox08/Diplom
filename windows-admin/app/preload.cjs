const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktopBridge',{
 saveFile:(name,content)=>ipcRenderer.invoke('save-file',{name,content}),
 onCommand:callback=>ipcRenderer.on('admin-command',(_event,command)=>callback(command))
});
