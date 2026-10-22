/* Hover and keyboard tooltip regression. Public reads only. */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const base=process.env.BYTESTORE_PREVIEW_URL||'http://127.0.0.1:8878/';
for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.goto(base+'catalog.html',{waitUntil:'networkidle'});const button=page.locator('.pc__fav').first();await button.hover();const tooltip=page.getByRole('tooltip');await tooltip.waitFor({state:'visible'});assert.equal(await tooltip.textContent(),'В избранное');const rect=await tooltip.boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width&&rect.y+rect.height<=900);assert.equal(await tooltip.evaluate(el=>el.parentNode===document.body),true);await page.screenshot({path:'/tmp/bytestore-tooltip-'+width+'.png'});await page.keyboard.press('Escape');assert.equal(await tooltip.isVisible(),false);
// Tabbing to a button exposes the same description without a mouse.
await page.mouse.move(0,0);await button.focus();await page.keyboard.press('Tab');await tooltip.waitFor({state:'visible'});assert.equal(await tooltip.textContent(),'К сравнению');await page.keyboard.press('Escape');
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
await page.goto(base+'product.html?id=gpu-rtx4060',{waitUntil:'networkidle'});await page.locator('.buy-row .tip').first().hover();await page.getByRole('tooltip').waitFor({state:'visible'});assert.deepEqual(errors,[]);console.log('PASS: tooltips escape cards, fit four screen widths, support keyboard/Escape and remain visible on product pages. No database writes.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
