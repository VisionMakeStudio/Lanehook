/* How to use LaneHook: searchable guide for the Driver Portal */
(() => {
  const SUP = 'info@visionmakestudio.com';
  LH.supportHref = () => { const em = (LH.auth && LH.auth.user && LH.auth.user.email) || ''; return 'mailto:' + SUP + '?subject=' + encodeURIComponent('LaneHook support') + '&body=' + encodeURIComponent(em ? 'My LaneHook account: ' + em + '\n\nHow can we help?\n' : 'How can we help?\n'); };
  LH.supportCard = () => `<div class="card"><h3>Need help?</h3><p class="muted" style="margin:6px 0 12px;font-size:14px">Email us and a real person will write back.</p><a class="btn" href="${esc(LH.supportHref())}">${ic('send', 16)}${SUP}</a></div>`;
  const T = [
    ['Home', '', '#/home', 'dashboard start status', ['Open Home to see your active load, what you are owed and what needs attention.', 'Tap New load to add a load, or Check a broker before you accept one.', 'Tap a card under Needs attention to fix it.']],
    ['Add and track a load', '', '#/load/new', 'load new add booking stage', ['Tap Loads, then New load.', 'Fill in the broker, rate, pickup and delivery. Miles help the profit number.', 'Save it. Tap the big button on the load to move it forward: picked up, delivered, invoiced, paid.']],
    ['Scan a rate confirmation', '', '#/load/new', 'ratecon rate con scan photo read', ['Tap Loads, then New load.', 'Tap Scan rate confirmation and take a clear photo or pick the file.', 'Check what it filled in, fix anything wrong, then save. The file stays attached to the load.']],
    ['Load Guard: check a broker', '', '#/guard', 'guard broker mc scam fraud authority check', ['Tap Check a broker.', 'Type the MC number and the company name, then tap Check.', 'Read the result. Green is fine, yellow means look closer, red means do not book it.']],
    ['Detention timer', '', '#/loads', 'detention wait time timer arrive leaving claim', ['Open the load.', 'Tap I\'ve arrived when you get to the dock.', 'Tap I\'m leaving when you pull out. LaneHook counts the waiting time past your free hours.', 'Tap Copy claim or Share to send the detention claim to the broker.']],
    ['Money, invoices and getting paid', '', '#/money', 'invoice paid unpaid overdue reminder money income', ['Open a delivered load and tap Create invoice.', 'Tap View and send, then Email broker or Print or save PDF.', 'Use Payment reminder when it is late, and Mark paid when the money lands.', 'Open Money to see what you are owed and what you earned.']],
    ['Brokers', '', '#/brokers', 'broker notes rating', ['Open More, then Brokers.', 'Tap a broker to see your loads, your notes and how fast they pay.']],
    ['Documents', '', '#/vault', 'documents vault insurance registration authority expiry', ['Open More, then Documents.', 'Add insurance, registration, authority and other papers with a photo.', 'LaneHook warns you before they expire.']],
    ['Profit calculator and Tools', '', '#/calc', 'profit calculator cost per mile tools', ['Open More, then Profit calculator.', 'Enter the rate, miles and costs before you accept the load.', 'Open Tools for detention and cost per mile. Your numbers are saved.']],
    ['Fuel log', '', '#/fuel', 'fuel mpg ifta receipt gallons', ['Open More, then Fuel log, or tap Log fuel on Home.', 'Add the gallons, price and state. Snap the receipt if you want.', 'LaneHook works out your MPG and the fuel by state for IFTA.']],
    ['Scan to PDF', '', '#/scan', 'scan pdf bol pod paperwork pages', ['Tap Scan to PDF.', 'Photograph each page. Reorder or delete pages if you need to.', 'Save the PDF, or send it to the broker.']],
    ['Road tools', '', '#/road', 'road truck stop parking scale repair map', ['Open More, then Road tools.', 'Pick truck stops, parking, scales or repair near you.']],
    ['Inspections', '', '#/inspect', 'inspection pre-trip post-trip checklist dvir', ['Open More, then Inspections.', 'Choose pre-trip or post-trip and tick each item as you go.', 'Note any defect and save it.']],
    ['Breakdown kit', '', '#/breakdown', 'breakdown roadside tow contacts location', ['Open More, then Breakdown kit.', 'Save your roadside and tow contacts ahead of time.', 'When you need help, share your location from here.']],
    ['Truck care', '', '#/maint', 'maintenance service odometer oil reminders', ['Open More, then Truck care.', 'Add your odometer and each service you do.', 'LaneHook reminds you when the next one is due.']],
    ['Dispatch: work for a company', '', '#/settings', 'dispatch join company code accept decline status chat check in', ['Open Settings and find Join a company. Type the code your dispatcher gave you and tap Join.', 'Dispatch now shows in your menu. New loads appear there.', 'Tap Accept or Decline, then Picked up and Delivered as the load moves.', 'Use Messages to chat with your dispatcher. On a Fleet company you can also tap Check in to share where you are, one time.']],
    ['Settings', '', '#/settings', 'settings business name mc dot backup language', ['Open More, then Settings.', 'Add your name, business name, MC and payment info. They go on every invoice.', 'Set your MPG and fuel price for better profit numbers.', 'Make a backup now and then.']]
  ];
  const item = (t, i) => `<details class="gt" data-k="${esc((t[0] + ' ' + t[3]).toLowerCase())}"><summary><b>${esc(t[0])}</b>${t[1] ? `<span class="badge">${esc(t[1])}</span>` : ''}</summary><ol>${t[4].map(s => `<li>${esc(s)}</li>`).join('')}</ol><a class="btn sm pri" href="${t[2]}">Take me there</a></details>`;
  LH.pages.guide = () => ({
    title: 'How to use LaneHook', back: 'settings',
    html: `<p class="muted" style="margin:0 0 12px">Pick a topic for simple steps. Or search.</p><input id="guideQ" type="search" placeholder="Search, for example invoice" aria-label="Search topics" autocomplete="off" style="margin-bottom:12px"><div id="guideList">${T.map(item).join('')}</div><p class="muted" id="guideNone" style="display:none">Nothing found. Email us and we will help.</p>${LH.supportCard()}`
  });
  document.addEventListener('input', e => {
    if (e.target.id !== 'guideQ') return; const q = e.target.value.trim().toLowerCase(); let n = 0;
    document.querySelectorAll('#guideList .gt').forEach(d => { const m = !q || d.dataset.k.includes(q) || d.textContent.toLowerCase().includes(q); d.style.display = m ? '' : 'none'; if (m) n++; });
    const z = document.getElementById('guideNone'); if (z) z.style.display = n ? 'none' : '';
  });
  /* start-here card for new accounts */
  LH.guideHint = () => { let x = false; try { x = localStorage.getItem('lh-guide-x') === '1'; } catch (e) {} if (x || (LH.S.loads || []).length) return ''; return `<div class="alert" id="guideHint"><i></i><div><b>New here? Start here</b><small>Short steps for every part of LaneHook. <a href="#/guide" style="font-weight:700">Open the guide</a> <button class="btn sm" data-act="guideX" style="margin-left:6px">Hide</button></small></div></div>`; };
  LH.acts.guideX = () => { try { localStorage.setItem('lh-guide-x', '1'); } catch (e) {} const h = document.getElementById('guideHint'); if (h) h.remove(); };
})();
