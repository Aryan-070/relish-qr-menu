import { chromium } from 'playwright'
const BASE='http://localhost:5173', OUT='assets/pitch/screens'
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:402,height:874},deviceScaleFactor:2}); const p=await ctx.newPage()
const tap=async(t,o={})=>{for(const x of (Array.isArray(t)?t:[t])){try{await p.getByText(x,o).first().click({timeout:2500});return true}catch{}}return false}
await p.goto(BASE,{waitUntil:'networkidle'})
await p.evaluate(()=>{localStorage.removeItem('relish.ops.v1');localStorage.removeItem('relish.cart.v1')})
await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(2000)
await tap(['Open Menu','View Menu']); await p.waitForTimeout(1400)
const card=p.locator('div',{hasText:/₹\d/}).filter({has:p.locator('img,video')}).first()
await card.click({timeout:3000}); await p.waitForTimeout(1100)
await tap(['Add to Order']); await p.waitForTimeout(1000)
await tap(['Continue','Keep browsing','Done']); await p.waitForTimeout(900)
// click the bottom-nav ORDER button by locating an element whose trimmed text is exactly Order/My Order
const handle = await p.evaluateHandle(()=>{
  const els=[...document.querySelectorAll('button,[role=button],div')]
  // prefer the bottom-nav order control (has a badge number + 'Order')
  const cand=els.filter(e=>{const t=(e.textContent||'').replace(/\s+/g,' ').trim(); const r=e.getBoundingClientRect(); return /order/i.test(t)&&t.length<14&&r.top>innerHeight*0.8&&r.width<160})
  return cand[cand.length-1]||null
})
const el = handle.asElement()
if(el){ await el.click(); } else { console.log('no bottom order el') }
await p.waitForTimeout(1400)
let body=await p.innerText('body'); console.log('panel open?', /Your Order|Place Order|Pay bill/i.test(body))
if(await tap(['Pay bill'])){ await p.waitForTimeout(1600); await p.screenshot({path:`${OUT}/guest-checkout.png`}); console.log('SAVED guest-checkout') }
else console.log('NO pay bill')
await b.close()
