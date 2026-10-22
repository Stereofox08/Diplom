(function(){
 'use strict';
 BS.util.download=function(name,content){window.desktopBridge.saveFile(name,String(content)).catch(function(){BS.layout.toastError('Не удалось сохранить файл');});};
 window.desktopAdmin={backup:function(){if(!BS.db.isAdmin()){BS.layout.toast('Войдите в админку','warn');return;}BS.util.download('bytestore-export.json',JSON.stringify(BS.db.state,null,2));}};
 window.desktopBridge.onCommand(async function(command){
  try{
   if(command==='backup')window.desktopAdmin.backup();
   if(command==='refresh'){await BS.cloud.refresh();BS.admin.init();}
   if(command==='logout'){await BS.db.adminLogout();BS.admin.init();}
  }catch(error){BS.layout.toastError(error.message);}
 });
 document.addEventListener('click',function(event){var link=event.target.closest('a');if(link&&/^(index|product)\.html/.test(link.getAttribute('href')||'')){event.preventDefault();window.open('https://stereofox08.github.io/Diplom/'+link.getAttribute('href'),'_blank');}},true);
})();
