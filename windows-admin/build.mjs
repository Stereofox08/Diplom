import {packager} from '@electron/packager';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const parent=path.join(root,'..');
const source=process.argv[2]?path.resolve(process.argv[2]):await fs.access(path.join(parent,'admin.html')).then(()=>parent).catch(()=>path.join(parent,'site'));
const web=path.join(root,'app','web');
await fs.rm(web,{recursive:true,force:true});await fs.mkdir(web,{recursive:true});
for(const folder of ['css','js'])await fs.cp(path.join(source,folder),path.join(web,folder),{recursive:true});
let html=await fs.readFile(path.join(source,'admin.html'),'utf8');
html=html.replace('</head>','<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https:; connect-src https://mxyifzuhdojdyesussxj.supabase.co; font-src \'self\'; object-src \'none\'; base-uri \'none\';"><style>a[href=\"index.html\"]{display:none!important}</style></head>');
html=html.replace('  <script src="js/app.js"></script>','  <script src="desktop.js"></script>\n  <script src="js/app.js"></script>');
await fs.copyFile(path.join(source,'brand-icon.svg'),path.join(web,'brand-icon.svg'));
await fs.writeFile(path.join(web,'admin.html'),html);await fs.copyFile(path.join(root,'app','desktop.js'),path.join(web,'desktop.js'));
await fs.copyFile(path.join(root,'assets','icon.ico'),path.join(root,'app','icon.ico'));
const platform=process.env.TARGET_PLATFORM||'win32',arch=platform==='darwin'?'arm64':'x64';
const output=await packager({dir:path.join(root,'app'),name:'ByteStore Admin',executableName:'ByteStore Admin',platform,arch,electronVersion:'45.0.0',out:path.join(root,'dist'),overwrite:true,asar:true,prune:false,icon:platform==='win32'?path.join(root,'assets','icon.ico'):undefined,win32metadata:{CompanyName:'ByteStore',ProductName:'ByteStore Admin',FileDescription:'ByteStore administration'}});
if(platform==='win32'){
 for(const dir of output){
  await fs.writeFile(path.join(dir,'Run ByteStore.cmd'),'@echo off\r\ncd /d "%~dp0"\r\n"%~dp0ByteStore Admin.exe" > "%TEMP%\\bytestore-admin.log" 2>&1\r\n');
  await fs.copyFile(path.join(root,'README.md'),path.join(dir,'README.md'));
 }
}
console.log(output.join('\n'));
