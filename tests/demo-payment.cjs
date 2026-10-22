const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/cart.html',{waitUntil:'networkidle'});
  await page.evaluate(()=>{BS.auth.isLoggedIn=()=>true;BS.auth.user=()=>({id:'payment-test',name:'Покупатель',phone:'+77000000000',email:'example@example.com'});window.orders=[];BS.db.createOrder=async data=>{orders.push(data);return {ok:false,message:'Тест: заказ не отправлен'};};BS.db.addToCart('cpu-i3-14100f',1);BS.pages.cart.render();});
  async function checkout(method){await page.evaluate(()=>BS.pages.cart.openCheckout());const select=page.locator('#coPayment');assert.equal(await select.locator('option').count(),4);await select.selectOption(method);await page.locator('[data-checkout-submit]').click();}
  async function close(){await page.locator('.modal [data-close]').first().click();}
  await checkout('Картой онлайн');assert.equal(await page.evaluate(()=>orders.length),0);await page.locator('[data-card-pay]').click();assert.equal(await page.evaluate(()=>orders.length),0);
  await page.locator('#cardNumber').fill('4242 4242 4242 4242');await page.locator('#cardHolder').fill('TEST USER');await page.locator('#cardExpiry').fill('12/30');await page.locator('#cardCvc').fill('123');await page.locator('[data-card-pay]').click();await page.waitForFunction(()=>orders.length===1);await close();
  await checkout('Единый QR');assert.equal(await page.locator('.qr-payment svg').count(),1);await page.locator('[data-qr-paid]').click();await page.waitForFunction(()=>orders.length===2);await close();
  await checkout('Рассрочка');await page.locator('[name=installmentBank][value=Kaspi]').check();await page.locator('[data-bank-continue]').click();await page.waitForFunction(()=>orders.length===3);await close();
  await checkout('При получении');await page.waitForFunction(()=>orders.length===4);await close();
  const orders=await page.evaluate(()=>orders);assert.deepEqual(orders.map(o=>o.payment),['Картой онлайн','Единый QR','Рассрочка 0-0-6 · Kaspi','При получении']);assert.doesNotMatch(JSON.stringify(orders),/4242|TEST USER|12\/30|123/);assert.deepEqual(errors,[]);
  console.log('PASS: card validation, QR, installment and pay-on-delivery; no card details in order payload. No orders created.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exit(1)});
