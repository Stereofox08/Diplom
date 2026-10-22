const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BYTESTORE_TEST_URL || 'http://127.0.0.1:8765/';
const accounts = JSON.parse(fs.readFileSync(process.env.BYTESTORE_TEST_ACCOUNTS || '/tmp/bytestore-test-accounts.json')).users;
let testBrowser;
(async () => {
 const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 testBrowser=browser;
 const failures=[]; const contexts=[];
 async function client(account, admin=false){
  const c=await browser.newContext();contexts.push(c);const p=await c.newPage();p.on('pageerror',e=>failures.push(e.message));
  await p.goto(base+(admin?'admin.html':'catalog.html'),{waitUntil:'networkidle'});
  await p.waitForFunction(()=>window.BS && BS.cloud && BS.db.state);
  console.log('Loaded',admin?'admin':account?account.email:'guest');
  if(account){
   if(admin){await p.locator('#adLogin').fill(account.email);await p.locator('#adPass').fill(account.password);await p.locator('[data-admin-login] button[type=submit]').click();await p.waitForFunction(()=>BS.db.isAdmin());console.log('Admin login passed');}
   else {const r=await p.evaluate(async a=>BS.auth.login(a.email,a.password),account);assert.equal(r.ok,true,r.message);}
  }
  return p;
 }
 const admin=await client(accounts.find(a=>a.admin),true), a=await client(accounts.find(a=>a.email.startsWith('qa-a'))),b=await client(accounts.find(a=>a.email.startsWith('qa-b'))),guest=await client();
 assert.equal(await admin.evaluate(()=>BS.db.productsAll().length),60);
 assert.deepEqual(await guest.evaluate(()=>({users:BS.db.state.users.length,orders:BS.db.state.orders.length,cost:BS.db.productsAll().reduce((s,p)=>s+p.cost,0)})),{users:0,orders:0,cost:0});
 await admin.evaluate(()=>{for(const id of ['dashboard','products','images','categories','orders','reviews','users','promos','ai','log'])BS.admin.show(id);});
 console.log('Snapshots and panels passed');
 await admin.evaluate(async()=>{for(const o of BS.db.orders({}).filter(o=>o.comment==='BYTESTORE_AUTOMATED_TEST'&&o.status!=='cancelled'))await BS.db.setOrderStatus(o.id,'cancelled');});
 const original=await admin.evaluate(()=>JSON.parse(JSON.stringify(BS.db.product('cpu-i3-14100f'))));
 // Real admin form: await server success, then read from another client.
 await admin.evaluate(()=>BS.admin.show('products'));
 console.log('Opening product form');
 await admin.locator('[data-product-edit="'+original.id+'"]').click();
 const price=admin.locator('[data-product-form] [name=price]');await price.fill(String(original.price+10));await admin.locator('[data-product-save]').click();
 await admin.waitForFunction(x=>BS.db.product(x.id).price===x.price,{id:original.id,price:original.price+10});
 await guest.evaluate(()=>BS.cloud.refresh());assert.equal(await guest.evaluate(id=>BS.db.product(id).price,original.id),original.price+10);
 const stale=await admin.evaluate(async p=>{try{await BS.cloud.request('/rest/v1/rpc/store_command',{method:'POST',body:{op:'saveProduct',args:[p]}});return false;}catch(e){return /изменился/.test(e.message);}},original);assert.equal(stale,true);
 await admin.evaluate(async p=>{await BS.db.saveProduct(Object.assign({},BS.db.product(p.id),{price:p.price}));},original);
 // Authenticated buyers cannot administer or read other buyers' data.
 assert.equal(await a.evaluate(async id=>{try{await BS.cloud.request('/rest/v1/rpc/store_command',{method:'POST',body:{op:'updateStock',args:[id,999,1]}});return false;}catch(e){return true;}},original.id),true);
 await a.evaluate(()=>BS.cloud.refresh());
 const order=await a.evaluate(async id=>{BS.db.addToCart(id,1);return BS.db.createOrder({customer:{name:'Тестовый покупатель',phone:'+77000000000',email:'qa-a@bytestore.invalid'},city:'Алматы',address:'Тест',comment:'BYTESTORE_AUTOMATED_TEST'});},original.id);
 assert.equal(order.ok,true,order.message);assert.ok(order.order.id);assert.equal(order.order.paymentStatus,'unpaid');
 await admin.evaluate(()=>BS.cloud.refresh());assert.equal(await admin.evaluate(id=>!!BS.db.order(id),order.order.id),true);
 await b.evaluate(()=>BS.cloud.refresh());assert.equal(await b.evaluate(id=>!!BS.db.order(id),order.order.id),false);
 await guest.evaluate(()=>BS.cloud.refresh());assert.equal(await guest.evaluate(()=>BS.db.state.orders.length),0);
 // Confirmation from a buyer before shipment is forbidden.
 assert.equal(await a.evaluate(async id=>{try{await BS.db.setOrderStatus(id,'delivered');return false;}catch(e){return true;}},order.order.id),true);
 await admin.evaluate(async id=>{await BS.db.setOrderStatus(id,'cancelled');await BS.db.setOrderStatus(id,'cancelled');},order.order.id);
 assert.equal(await admin.evaluate(id=>BS.db.product(id).stock,original.id),original.stock);
 // Stock race: only one client can buy the final unit.
 await admin.evaluate(id=>BS.db.updateStock(id,1),original.id);await Promise.all([a.evaluate(()=>BS.cloud.refresh()),b.evaluate(()=>BS.cloud.refresh())]);
 const payload=await a.evaluate(id=>({requestId:crypto.randomUUID(),lines:[{productId:id,qty:1}],customer:{name:'QA',phone:'+77000000000'},comment:'BYTESTORE_AUTOMATED_TEST',expectedTotal:BS.db.product(id).price+BS.db.settings().deliveryCost}),original.id);
 if(original.price>=250000)payload.expectedTotal=original.price;
 const payloads=[payload,{...payload,requestId:require('node:crypto').randomUUID()}];
 const results=await Promise.all([a,b].map((p,i)=>p.evaluate(async data=>{try{return await BS.cloud.request('/rest/v1/rpc/checkout',{method:'POST',body:{payload:data}});}catch(e){return {ok:false,message:e.message};}}, payloads[i])));
 assert.equal(results.filter(x=>x.ok).length,1,JSON.stringify(results));
 const winningIndex=results[0].ok?0:1;const winningPage=[a,b][winningIndex];const winningPayload=payloads[winningIndex];
 // The winning request ID is retained for an exact retry.
 {const retry=await winningPage.evaluate(data=>BS.cloud.request('/rest/v1/rpc/checkout',{method:'POST',body:{payload:data}}),winningPayload);assert.equal(retry.orderId,results[winningIndex].orderId);}
 await admin.evaluate(()=>BS.cloud.refresh());assert.equal(await admin.evaluate(id=>BS.db.product(id).stock,original.id),0);
 await admin.evaluate(id=>BS.db.setOrderStatus(id,'cancelled'),results[winningIndex].orderId);
 await admin.evaluate(p=>BS.db.updateStock(p.id,p.stock),original);
 // Reviews: buyer submission is pending; publishing is admin-only.
 const review=await a.evaluate(id=>BS.db.addReview({productId:id,rating:5,text:'Проверочный отзыв для теста общей базы.'}),original.id);assert.equal(review.ok,true);
 await admin.evaluate(()=>BS.cloud.refresh());const reviewId=await admin.evaluate(id=>BS.db.state.reviews.find(r=>r.productId===id).id,original.id);
 await guest.evaluate(()=>BS.cloud.refresh());assert.equal(await guest.evaluate(id=>!!BS.db.review(id),reviewId),false);
 await admin.evaluate(id=>BS.db.setReviewStatus(id,'published'),reviewId);await guest.evaluate(()=>BS.cloud.refresh());assert.equal(await guest.evaluate(id=>!!BS.db.review(id),reviewId),true);
 await admin.evaluate(id=>BS.db.deleteReview(id),reviewId);
 // Reload preserves server authentication and persisted products.
 await admin.reload({waitUntil:'networkidle'});assert.equal(await admin.evaluate(()=>BS.db.isAdmin()),true);
 assert.equal(await admin.evaluate(id=>BS.db.product(id).price,original.id),original.price);
 assert.deepEqual(failures,[]);
 console.log('PASS: real admin form; shared catalogue; role checks; order isolation; atomic stock race; retry idempotency; cancellation; review moderation; reload.');
 await browser.close();
})().catch(async error=>{console.error(error.stack);if(testBrowser)await testBrowser.close();process.exit(1)});
