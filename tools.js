'use strict';
/* LaneHook calculators. One engine, used by the public /tools/ pages (nothing saved) and by the Driver Portal (results saved to the account). */
(function () {
  const n = x => { const v = parseFloat(String(x == null ? '' : x).replace(/[^0-9.\-]/g, '')); return isFinite(v) ? v : 0; };
  const $$ = (v, d) => (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d == null ? (Math.round(v * 100) % 100 ? 2 : 0) : d, maximumFractionDigits: d == null ? 2 : d });
  const num = (v, d) => (isFinite(v) ? v : 0).toLocaleString('en-US', { maximumFractionDigits: d == null ? 1 : d });
  const hrs = h => { const m = Math.round(h * 60); return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min'; };
  const row = (label, value, o) => Object.assign({ label, value }, o || {});
  const f = (k, label, v, o) => Object.assign({ k, label, v: v == null ? '' : v }, o || {});

  const T = [
    {
      id: 'detention-pay-calculator', name: 'Detention pay', short: 'What the dock wait is worth, and what it cost you in lost miles.',
      title: 'Detention Pay Calculator', seo: 'Free detention pay calculator for truck drivers. Enter your time at the dock, free time and hourly rate to see what you are owed and what the wait cost you in lost miles.',
      intro: 'Brokers owe detention when you wait at a shipper or receiver past the free time on your rate confirmation. Enter your times to see what you are owed, then see what those hours could have earned if you had been rolling.',
      fields: [f('hours', 'Total time at the facility (hours)', 4.5, { step: 0.25 }), f('free', 'Free time on the rate con (hours)', 2, { step: 0.25 }), f('rate', 'Detention rate ($ per hour)', 65, { step: 1 }), f('cap', 'Daily cap in $ (0 for none)', 0, { step: 10 }),
        f('rpm', 'Your usual rate per mile ($)', 2.2, { step: 0.05, group: 'What the wait cost you' }), f('vcm', 'Your cost per mile ($)', 1.45, { step: 0.05 }), f('mph', 'Average speed (mph)', 50, { step: 1 })],
      calc(v) {
        const bill = Math.max(0, v.hours - v.free); let owed = bill * v.rate; if (v.cap > 0) owed = Math.min(owed, v.cap);
        const miles = v.hours * v.mph, margin = miles * (v.rpm - v.vcm), net = owed - margin;
        return { rows: [row('Detention owed', $$(owed), { big: 1, tone: 'ok' }), row('Billable hours', hrs(bill)), row('Miles you could have run', num(miles, 0) + ' mi'), row('Margin you could have earned', $$(margin)), row('Detention minus lost margin', $$(net), { tone: net < 0 ? 'bad' : 'ok' }), row('Effective rate per hour at the dock', $$(v.hours ? owed / v.hours : 0))],
          note: net < 0 ? 'Detention did not cover what those hours could have earned on the road. Ask for a higher hourly rate or shorter free time on the next rate confirmation.' : 'Detention covered the lost time on the road.' };
      },
      faq: [['When does the detention clock start?', 'It depends on the rate confirmation. Many start at your appointment time, or at your arrival if you were early. Read the clause before you count the hours.'], ['What is a normal free time?', 'Two hours is common, but it is whatever your rate confirmation says. If it says nothing, ask the broker before you accept the load.'], ['How do I prove detention?', 'Keep the arrival and departure times, ideally with GPS and a photo of the signed paperwork, plus the load number and the rate con clause. LaneHook records these for you.']]
    },
    {
      id: 'detention-cost-per-year', name: 'Yearly detention loss', short: 'How much unpaid dock waiting costs you every year.',
      title: 'Annual Detention Cost Calculator', seo: 'How much does unpaid detention cost a truck driver each year? Enter your weekly hours past free time and your rate to see the weekly, monthly and yearly total.',
      intro: 'Unpaid waiting adds up quietly. Enter the hours you usually wait past your free time and see what it comes to over a year.',
      fields: [f('hours', 'Hours past free time per week', 4, { step: 0.5 }), f('rate', 'Detention rate ($ per hour)', 60, { step: 1 }), f('weeks', 'Weeks on the road per year', 48, { step: 1 })],
      calc(v) { const w = v.hours * v.rate; return { rows: [row('Per week', $$(w)), row('Per month', $$(w * v.weeks / 12)), row('Per year', $$(w * v.weeks), { big: 1, tone: 'bad' })], note: 'This is the value of the waiting time if every hour were billed and paid. Industry surveys suggest many drivers are never paid for part of it, which is why keeping timestamps matters.' }; },
      faq: [['Is this what I am owed?', 'It is an estimate of the time you spent waiting past the free time, at your rate. What you actually collect depends on your rate confirmations and whether you file the claim.']]
    },
    {
      id: 'cost-per-mile-calculator', name: 'Cost per mile', short: 'Your true cost of every mile, fixed and running costs together.',
      title: 'Cost Per Mile Calculator for Owner-Operators', seo: 'Free cost per mile calculator for owner-operators and box truck drivers. Add fixed monthly costs and running costs to find what every mile really costs you.',
      intro: 'You cannot know if a load is good until you know what a mile costs you. Add your monthly fixed costs and your running costs per mile.',
      fields: [f('truck', 'Truck payment ($ per month)', 1500, { step: 50, group: 'Fixed costs, per month' }), f('ins', 'Insurance ($ per month)', 1200, { step: 50 }), f('other', 'Permits, phone, software, other ($ per month)', 300, { step: 25 }), f('miles', 'Miles driven per month', 6000, { step: 100 }),
        f('fuelp', 'Fuel price ($ per gallon)', 4.2, { step: 0.05, group: 'Running costs' }), f('mpg', 'Truck MPG', 9, { step: 0.1 }), f('maint', 'Maintenance and tires ($ per mile)', 0.15, { step: 0.01 }), f('tolls', 'Tolls and other ($ per mile)', 0.03, { step: 0.01 })],
      calc(v) { const fixed = v.miles ? (v.truck + v.ins + v.other) / v.miles : 0, fuel = v.mpg ? v.fuelp / v.mpg : 0, run = fuel + v.maint + v.tolls, total = fixed + run;
        return { rows: [row('Total cost per mile', $$(total, 2), { big: 1 }), row('Fixed cost per mile', $$(fixed, 2)), row('Fuel per mile', $$(fuel, 2)), row('Maintenance, tires, tolls per mile', $$(v.maint + v.tolls, 2)), row('Monthly cost at this mileage', $$(total * v.miles))], note: 'Any load that pays less per mile than this loses money before you pay yourself.' }; },
      faq: [['What should I include in fixed costs?', 'Anything you pay whether or not the truck moves: truck payment, insurance, permits, phone, software and your accountant.'], ['Where do I get my real numbers?', 'Your expenses in LaneHook add up by category, so after a few weeks you can use real figures instead of estimates.']]
    },
    {
      id: 'freight-rate-calculator', name: 'Minimum load rate', short: 'The lowest rate a load can pay and still be worth taking.',
      title: 'Minimum Freight Rate Calculator', seo: 'Free minimum load rate calculator for truckers. Enter loaded miles, deadhead miles and your cost per mile to find the lowest rate worth accepting.',
      intro: 'Before you counter a broker, know your floor. This works backward from your costs to the lowest rate that still pays you.',
      fields: [f('loaded', 'Loaded miles', 300, { step: 10 }), f('dead', 'Deadhead miles to pickup', 40, { step: 5 }), f('cpm', 'Your cost per mile ($)', 1.6, { step: 0.05 }), f('profit', 'Profit you want ($ per mile)', 0.4, { step: 0.05 }), f('extra', 'Tolls and extras for this load ($)', 25, { step: 5 })],
      calc(v) { const all = v.loaded + v.dead, cost = all * v.cpm + v.extra, minr = cost + all * v.profit, rpm = v.loaded ? minr / v.loaded : 0;
        return { rows: [row('Minimum rate to accept', $$(minr), { big: 1, tone: 'ok' }), row('That is per loaded mile', $$(rpm, 2)), row('Total miles driven', num(all, 0) + ' mi'), row('Your cost for this load', $$(cost)), row('Profit at that rate', $$(minr - cost))], note: 'Deadhead miles cost fuel and time, so they are included. Use this as your starting counter, not your final offer.' }; },
      faq: [['Why count deadhead miles?', 'Driving to the pickup empty costs the same per mile as driving loaded, but nobody pays you for it, so the loaded rate has to cover it.']]
    },
    {
      id: 'deadhead-miles-calculator', name: 'Deadhead miles', short: 'How much empty miles are costing you.',
      title: 'Deadhead Miles Calculator', seo: 'Free deadhead miles calculator. See your deadhead percentage, what empty miles cost and what you really earn per mile on a load.',
      intro: 'Empty miles still cost fuel and time. Enter a load to see your deadhead percentage and your real rate per mile.',
      fields: [f('loaded', 'Loaded miles', 300, { step: 10 }), f('dead', 'Empty (deadhead) miles', 80, { step: 5 }), f('rate', 'Total rate for the load ($)', 750, { step: 25 }), f('cpm', 'Your cost per mile ($)', 1.5, { step: 0.05 })],
      calc(v) { const all = v.loaded + v.dead, pct = all ? v.dead / all * 100 : 0, real = all ? v.rate / all : 0, ads = v.loaded ? v.rate / v.loaded : 0;
        return { rows: [row('Deadhead percentage', num(pct, 1) + '%', { big: 1, tone: pct > 20 ? 'bad' : '' }), row('Rate per loaded mile', $$(ads, 2)), row('Real rate per mile, all miles', $$(real, 2)), row('Cost of the empty miles', $$(v.dead * v.cpm)), row('Profit after all miles', $$(v.rate - all * v.cpm), { tone: v.rate - all * v.cpm < 0 ? 'bad' : 'ok' })], note: 'The rate a broker quotes per loaded mile hides your deadhead. The real rate per mile is the one that pays your bills.' }; },
      faq: [['What is a good deadhead percentage?', 'Lower is better. Many drivers aim to stay well under 15 to 20 percent over a month, but it depends on your lanes.']]
    },
    {
      id: 'truck-driver-pay-calculator', name: 'Driver pay', short: 'Turn a per-mile rate into weekly, monthly and yearly pay.',
      title: 'Truck Driver Pay Calculator', seo: 'Free truck driver pay calculator. Turn a cents-per-mile rate into weekly, monthly and yearly pay, including bonuses.',
      intro: 'Comparing job offers? Turn a per-mile rate into what you take home each week, month and year.',
      fields: [f('cpm', 'Pay per mile ($)', 0.6, { step: 0.01 }), f('miles', 'Miles per week', 2500, { step: 50 }), f('bonus', 'Bonuses or extras per week ($)', 0, { step: 10 }), f('weeks', 'Weeks worked per year', 50, { step: 1 })],
      calc(v) { const w = v.cpm * v.miles + v.bonus; return { rows: [row('Per week', $$(w)), row('Per month', $$(w * v.weeks / 12)), row('Per year', $$(w * v.weeks), { big: 1, tone: 'ok' })], note: 'This is gross pay before taxes. Unpaid time at the dock, layovers and breakdown days lower what you really earn per hour.' }; },
      faq: [['Is this before taxes?', 'Yes. It is gross pay.']]
    },
    {
      id: 'owner-operator-profit-calculator', name: 'Owner-operator profit', short: 'Estimate your yearly take-home after costs and taxes.',
      title: 'Owner-Operator Profit Calculator', seo: 'Free owner-operator profit calculator. Subtract fuel, truck, insurance and other costs from your revenue to estimate yearly take-home pay.',
      intro: 'See how much of your revenue is really yours. Enter your yearly numbers to estimate take-home pay.',
      fields: [f('rev', 'Yearly revenue ($)', 180000, { step: 1000 }), f('fuel', 'Fuel ($ per year)', 55000, { step: 500 }), f('truck', 'Truck payment ($ per year)', 18000, { step: 500 }), f('ins', 'Insurance ($ per year)', 14000, { step: 500 }), f('maint', 'Maintenance and tires ($ per year)', 12000, { step: 500 }), f('other', 'Everything else ($ per year)', 9000, { step: 500 }), f('tax', 'Tax set-aside (% of profit)', 25, { step: 1 })],
      calc(v) { const cost = v.fuel + v.truck + v.ins + v.maint + v.other, profit = v.rev - cost, tax = Math.max(0, profit) * v.tax / 100, take = profit - tax;
        return { rows: [row('Take-home after tax set-aside', $$(take), { big: 1, tone: take < 0 ? 'bad' : 'ok' }), row('Profit before tax', $$(profit)), row('Total costs', $$(cost)), row('Tax set-aside', $$(tax)), row('Take-home per month', $$(take / 12)), row('Profit margin', num(v.rev ? profit / v.rev * 100 : 0, 1) + '%')], note: 'The tax percentage is a planning number only. Ask your accountant what you should set aside.' }; },
      faq: [['What tax rate should I use?', 'It depends on your income and state. Use a planning figure and ask an accountant. This is not tax advice.']]
    },
    {
      id: 'fuel-surcharge-calculator', name: 'Fuel surcharge', short: 'A per-mile surcharge that covers fuel above a base price.',
      title: 'Fuel Surcharge Calculator', seo: 'Free fuel surcharge calculator for truckers. Find the per-mile and per-load fuel surcharge from the current diesel price, a base price and your MPG.',
      intro: 'A fuel surcharge passes rising diesel costs on to the customer. Enter a base price, today\'s price and your MPG.',
      fields: [f('base', 'Base fuel price ($ per gallon)', 3.5, { step: 0.05 }), f('now', 'Current fuel price ($ per gallon)', 4.2, { step: 0.05 }), f('mpg', 'Truck MPG', 9, { step: 0.1 }), f('miles', 'Miles on this load', 400, { step: 10 })],
      calc(v) { const per = v.mpg ? Math.max(0, v.now - v.base) / v.mpg : 0; return { rows: [row('Surcharge per mile', $$(per, 3), { big: 1 }), row('Surcharge for this load', $$(per * v.miles)), row('Fuel cost per mile at today\'s price', $$(v.mpg ? v.now / v.mpg : 0, 2))], note: 'Write the base price and the way the surcharge is calculated into the rate confirmation so both sides agree.' }; },
      faq: [['What base price should I use?', 'Use whatever your contract or rate confirmation names. If there is none, pick a reasonable base and put it in writing.']]
    },
    {
      id: 'per-diem-calculator', name: 'Per diem', short: 'Estimate the meal deduction for nights away from home.',
      title: 'Truck Driver Per Diem Calculator', seo: 'Free per diem calculator for over-the-road truck drivers. Estimate the meal deduction for your nights away from home. Estimate only; confirm with a tax professional.',
      intro: 'Over-the-road drivers who are subject to DOT hours-of-service rules may be able to deduct part of a daily meal allowance for days spent away from home on the road. Enter your days away to estimate the deduction.',
      fields: [f('days', 'Days away from home on the road', 220, { step: 1 }), f('rate', 'Daily allowance ($), check the current IRS rate', 80, { step: 1 }), f('pct', 'Deductible share (%)', 80, { step: 1 }), f('bracket', 'Your combined tax rate (%) for a rough savings estimate', 25, { step: 1 })],
      calc(v) { const ded = v.days * v.rate * v.pct / 100; return { rows: [row('Estimated deduction', $$(ded), { big: 1, tone: 'ok' }), row('Per full day', $$(v.rate * v.pct / 100)), row('Rough tax savings', $$(ded * v.bracket / 100))], note: 'This is an estimate. Whether you qualify, the current rate, and partial days depend on IRS rules. Check the current IRS notice and ask a tax professional before you rely on it. Keep a log of the days you are away.' }; },
      faq: [['What rate should I enter?', 'The IRS publishes the daily rate for transportation workers each year. The prefilled number is a starting point only. Confirm it on irs.gov.'], ['Is this tax advice?', 'No. It is an estimate for planning only.']]
    },
    {
      id: 'trucking-startup-cost-calculator', name: 'Startup cost', short: 'What it takes to start hauling before the first load pays.',
      title: 'Trucking Startup Cost Calculator', seo: 'Free trucking startup cost calculator. Estimate authority, insurance, truck, permits and the cash reserve you need before your first load pays.',
      intro: 'Thinking about starting your own truck or box truck business? Add up the costs you pay before the first load pays you. Every number here is editable, because costs vary a lot by state, truck and insurance.',
      fields: [f('truck', 'Truck down payment or purchase ($)', 15000, { step: 500 }), f('auth', 'Authority, filings and registration ($)', 800, { step: 50 }), f('ins', 'First insurance payment ($)', 3000, { step: 100 }), f('plates', 'Plates, permits, taxes ($)', 1200, { step: 100 }), f('gear', 'Equipment and setup ($)', 1500, { step: 100 }), f('res', 'Cash reserve before you start ($)', 8000, { step: 500 }), f('wait', 'Weeks until the first payment', 5, { step: 1 })],
      calc(v) { const sum = v.truck + v.auth + v.ins + v.plates + v.gear + v.res; return { rows: [row('Estimated cash needed', $$(sum), { big: 1 }), row('Of that, spent up front', $$(sum - v.res)), row('Cash reserve', $$(v.res)), row('Reserve per week of waiting', $$(v.wait ? v.res / v.wait : 0))], note: 'Brokers often pay 30 days or more after delivery, so most new carriers run short on cash in the first two months. These are your own estimates. Get real quotes before you commit.' }; },
      faq: [['Why a cash reserve?', 'Fuel, insurance and repairs are due before the first invoice is paid. Without a reserve, a slow-paying broker can stop you.']]
    }
  ];
  const byId = id => T.find(t => t.id === id);

  function values(t, root) { const v = {}; t.fields.forEach(x => { const el = root.querySelector('[name="' + x.k + '"]'); v[x.k] = n(el ? el.value : x.v); }); return v; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  /* renders the form + live results. opts.onSave(inputs, result) shows a Save button; opts.prefill sets starting values. */
  function mount(el, id, opts) {
    opts = opts || {}; const t = byId(id); if (!t) return;
    const pre = opts.prefill || {}; let last = null, group = '';
    const fields = t.fields.map(x => { let h = ''; if (x.group && x.group !== group) { group = x.group; h = '<div class="tl-group">' + esc(x.group) + '</div>'; }
      return h + '<label class="tl-f"><span>' + esc(x.label) + '</span><input name="' + x.k + '" inputmode="decimal" autocomplete="off" value="' + esc(pre[x.k] != null ? pre[x.k] : x.v) + '"></label>'; }).join('');
    el.innerHTML = '<div class="tl"><form class="tl-form" onsubmit="return false">' + fields + '<button type="button" class="tl-reset">Reset</button></form><div class="tl-out" aria-live="polite"></div></div>';
    const out = el.querySelector('.tl-out'), form = el.querySelector('form');
    function run() {
      const v = values(t, form), r = t.calc(v); last = { inputs: v, result: r };
      out.innerHTML = r.rows.map(x => '<div class="tl-r ' + (x.big ? 'big ' : '') + (x.tone || '') + '"><span>' + esc(x.label) + '</span><b>' + esc(x.value) + '</b></div>').join('') + (r.note ? '<p class="tl-note">' + esc(r.note) + '</p>' : '') + (opts.onSave ? '<button type="button" class="tl-save">' + esc(opts.saveLabel || 'Save this result') + '</button>' : '');
      const sv = out.querySelector('.tl-save'); if (sv) sv.onclick = () => opts.onSave(last.inputs, last.result, t);
    }
    form.addEventListener('input', run);
    form.querySelector('.tl-reset').onclick = () => { t.fields.forEach(x => { form.querySelector('[name="' + x.k + '"]').value = x.v; }); run(); };
    run(); return { run, get: () => last };
  }
  window.LHTools = { list: T, get: byId, mount, fmt: { money: $$, num, hrs } };
})();
