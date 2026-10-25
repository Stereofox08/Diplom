/* Layout and navigation regression checks. No signups, emails, orders or database writes. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');let server,browser;const errors=[];const results=[];
 try{
  let base=process.env.BYTESTORE_PREVIEW_URL;
  if(!base){server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404).end();return;}const ext=path.extname(file);res.setHeader('Content-Type',ext==='.js'?'text/javascript':ext==='.css'?'text/css':ext==='.png'?'image/png':'text/html');fs.createReadStream(file).pipe(res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/';}
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  // Share a real public snapshot across visual checks to avoid repeated backend reads.
  let snapshot;
  await page.route('**/rest/v1/rpc/store_snapshot',async route=>{if(!snapshot){const response=await route.fetch();snapshot=await response.text();assert.equal(response.status(),200);}await route.fulfill({status:200,contentType:'application/json',body:snapshot});});
  await page.route('**/rest/v1/store_revision*',async route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{version:JSON.parse(snapshot||'{}').cloudRevision||0}])}));
  const files=['index.html','catalog.html','product.html?id=gpu-rtx4060','cart.html','configurator.html','register.html','login.html','favorites.html'];
  async function contained(label){const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(metrics.scroll<=metrics.width+1,label+' overflows: '+JSON.stringify(metrics));results.push(label);}
  for(const [theme,widths] of [['dark',[320,360,390,768,1024,1280,1440,1920]],['light',[320,360,390,768,1024,1280,1440,1920]]]){
   for(const width of widths){await page.setViewportSize({width,height:900});for(const file of files){
    await page.goto(base+file,{waitUntil:'networkidle'});await page.waitForSelector('.header__in');await page.evaluate(t=>BS.layout.setTheme(t),theme);
    if(file==='cart.html'){await page.evaluate(()=>{BS.db.addToCart('gpu-rtx4060',1);BS.db.addToCart('cpu-i7-14700kf',1);BS.pages.cart.render();});}
    await contained(theme+' '+width+' '+file);
    const header=await page.locator('.header__in').boundingBox();for(const sel of ['.header .logo','.header__search','.header__actions']){const b=await page.locator(sel).boundingBox();assert.ok(b.x>=header.x-1&&b.x+b.width<=header.x+header.width+1,sel+' leaves header at '+width);}
   }}
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base+'catalog.html',{waitUntil:'networkidle'});await page.waitForSelector('#catalogGrid .pc');
  assert.equal(await page.locator('#catalogGrid .pc').count(),12);const toggle=page.locator('[data-filters-toggle]');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');await page.locator('[data-filter-stock]').check();assert.equal(await toggle.getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  const query=page.locator('[data-filter-q]');await query.fill('Ryzen');await page.waitForFunction(()=>document.querySelectorAll('#catalogGrid .pc').length===3);await contained('filtered mobile catalog');
  await page.locator('[data-burger]').click();assert.equal(await page.locator('.drawer').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.drawer').count(),0);
  await page.goto(base+'cart.html',{waitUntil:'networkidle'});await page.waitForSelector('.header__in');await page.evaluate(()=>{BS.db.addToCart('gpu-rtx4060',1);BS.auth.isLoggedIn=()=>true;BS.auth.user=()=>({id:'layout-only',name:'Проверка интерфейса',email:'example@example.com',phone:'+77000000000'});BS.pages.cart.openCheckout();});
  assert.equal(await page.locator('#coPayment option').count(),4);assert.equal(await page.locator('.modal .form-grid').first().evaluate(e=>getComputedStyle(e).display),'grid');await contained('checkout modal mobile');const box=await page.locator('.modal').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);await page.keyboard.press('Escape');
  await page.evaluate(()=>BS.pages.cart.openCardPayment({total:199990},()=>{}));await contained('card modal mobile');assert.equal(await page.locator('#cardNumber').isVisible(),true);await page.keyboard.press('Escape');
  await page.goto(base+'product.html?id=gpu-rtx4060',{waitUntil:'networkidle'});await page.waitForSelector('.product-info');await page.setViewportSize({width:768,height:900});await page.locator('.buy-row .tip').first().hover();await contained('product tooltip hover');
  assert.deepEqual(errors,[]);console.log('PASS: '+results.length+' layout checks, header containment, two themes, filters, mobile menu, checkout/card dialogs and tooltip. No database writes.');
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error.stack);process.exit(1);});
