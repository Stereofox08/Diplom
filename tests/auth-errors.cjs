const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page=await browser.newPage();let signups=0;
  await page.route('**/auth/v1/signup',async route=>{signups++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{id:'test'}})});});
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base+'/register.html',{waitUntil:'networkidle'});
  await page.locator('#rgName').fill('Тестовый покупатель');await page.locator('#rgEmail').fill('example@example.com');await page.locator('#rgPhone').fill('+77000000000');await page.locator('#rgPass').fill('TestPassword123');await page.locator('#rgPass2').fill('TestPassword123');
  const submit=page.locator('[data-register-form] button[type=submit]');await submit.click();await page.waitForFunction(()=>document.querySelector('[data-register-form] button[type=submit]').textContent.includes('Проверьте почту'));
  assert.equal(await submit.isDisabled(),true);assert.equal(signups,1);assert.match(await page.locator('[data-register-error]').innerText(),/подтвердите e-mail/);
  await page.route('**/auth/v1/token?grant_type=password',route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'email_not_confirmed',msg:'Email not confirmed'})}));
  await page.goto(base+'/login.html',{waitUntil:'networkidle'});await page.locator('#lnEmail').fill('example@example.com');await page.locator('#lnPass').fill('TestPassword123');await page.locator('[data-login-form] button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('[data-login-error]').textContent.includes('Подтвердите e-mail'));
  assert.doesNotMatch(await page.locator('[data-login-error]').innerText(),/Email not confirmed/);
  console.log('PASS: confirmation state prevents repeat signup; login explains unconfirmed e-mail in Russian. No accounts or emails created.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exit(1)});
