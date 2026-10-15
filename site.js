(function () {
  'use strict';

  var today = new Date();
  var iso = today.getFullYear() + '-' +
            String(today.getMonth() + 1).padStart(2, '0') + '-' +
            String(today.getDate()).padStart(2, '0');
  Array.prototype.forEach.call(document.querySelectorAll('input[type="date"]'), function (d) {
    d.min = iso;
  });

  function showError(input, on) {
    var msg = document.getElementById(input.id + '-err');
    if (msg) { msg.classList.toggle('on', on); }
    input.setAttribute('aria-invalid', on ? 'true' : 'false');
  }

  function looksLikeContact(v) {
    var digits = v.replace(/\D/g, '');
    return /\S+@\S+\.\S+/.test(v) || digits.length >= 9;
  }

  function validate(form) {
    var bad = [];
    Array.prototype.forEach.call(form.querySelectorAll('[data-required]'), function (input) {
      var v = input.value.trim();
      var ok = v !== '';
      if (ok && input.dataset.check === 'contact') { ok = looksLikeContact(v); }
      if (ok && input.type === 'number') { ok = Number(v) >= 1; }
      showError(input, !ok);
      if (!ok) { bad.push(input); }
    });
    return bad;
  }

  Array.prototype.forEach.call(document.querySelectorAll('form.enquiry'), function (form) {

    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') { showError(e.target, false); }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var summary = form.querySelector('.summary');
      var bad = validate(form);

      if (bad.length) {
        summary.textContent = bad.length === 1
          ? 'One thing still needs filling in, marked below.'
          : bad.length + ' things still need filling in, marked below.';
        summary.classList.add('on');
        bad[0].focus();
        return;
      }
      summary.classList.remove('on');

      if (form.dataset.sending) { return; }
      var button = form.querySelector('button[type="submit"]');
      var buttonText = button.textContent;
      form.dataset.sending = '1';
      button.disabled = true;
      button.textContent = 'Sending…';

      sendEnquiry(form).then(function () {
        showThanks(form);
      }, function () {
        delete form.dataset.sending;
        button.disabled = false;
        button.textContent = buttonText;
        summary.innerHTML = 'Sorry, that didn’t send. Please ring Helen on ' +
          '<a href="tel:+447800787225">07800 787225</a> or email ' +
          '<a href="mailto:rtyson56@btinternet.com">rtyson56@btinternet.com</a>.';
        summary.classList.add('on');
      });
    });
  });

  var WEB3FORMS_KEY = '532f9985-2a97-464f-8bd6-1fe0a7beb5e8';

  function field(form, name) {
    var el = form.querySelector('[name="' + name + '"]');
    return el ? el.value.trim() : '';
  }

  // Where the visitor arrived from: ?ref= on links we control (Google profile, Facebook, Hitched),
  // else the referring site, else typed or bookmarked. Read once, never stored.
  var cameVia = (function () {
    var ref = (location.search.match(/[?&]ref=([\w-]{1,40})/) || [])[1];
    if (ref) { return ref; }
    try {
      var host = document.referrer ? new URL(document.referrer).hostname : '';
      if (host && host !== location.hostname) { return host; }
    } catch (e) {}
    return 'direct (typed, bookmarked or an app)';
  })();

  var ASK_WHICH = {
    'A wedding venue': 'Which venue?',
    'A bridal fayre': 'Which fayre?',
    'Another wedding supplier': 'Who? (photographer, florist, planner\u2026)',
    'A friend or family member': 'Who should we thank?',
    'A wedding website or directory': 'Which one?',
    'An advert': 'Where did you see it?',
    'Saw one of the cars out and about': 'Where was it?',
    'Somewhere else': 'Where was it?'
  };

  function heardFrom(form) {
    var pick = field(form, 'heard_from');
    if (!pick) { return 'Not answered'; }
    var more = field(form, 'heard_from_more');
    return ASK_WHICH[pick] && more ? pick + ': ' + more : pick;
  }

  Array.prototype.forEach.call(document.querySelectorAll('select[name="heard_from"]'), function (sel) {
    var more = sel.parentNode.querySelector('[name="heard_from_more"]');
    sel.addEventListener('change', function () {
      var ask = ASK_WHICH[sel.value];
      more.hidden = !ask;
      if (ask) { more.placeholder = ask; more.setAttribute('aria-label', ask); }
    });
  });

  function longDate(iso) {
    var p = iso.split('-');
    if (p.length !== 3) { return iso; }
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function sendEnquiry(form) {
    if (!WEB3FORMS_KEY) { return Promise.resolve(); }
    var trap = form.querySelector('[name="botcheck"]');
    if (trap && trap.checked) { return Promise.resolve(); }

    var cars = Array.prototype.map.call(form.querySelectorAll('[name="cars"]:checked'), function (b) { return b.value; });
    var contact = field(form, 'contact');
    var date = longDate(field(form, 'wedding_date'));
    var data = {
      access_key: WEB3FORMS_KEY,
      subject: 'Website enquiry: ' + date + ', ' + field(form, 'name'),
      from_name: 'Tyson Wedding Cars website',
      'Date': date,
      'Collection postcode': field(form, 'pickup_postcode').toUpperCase(),
      'Venue': field(form, 'venue'),
      'People in the party': field(form, 'passengers'),
      'Cars': cars.length ? cars.join(', ') : 'Not chosen',
      'Name': field(form, 'name'),
      'Phone or email': contact,
      'Heard about us from': heardFrom(form),
      'Came via link': cameVia,
      'Sent from page': location.pathname,
      'Anything else': field(form, 'notes') || '-'
    };
    if (/\S+@\S+\.\S+/.test(contact)) { data.email = contact; }

    return fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || j.success !== true) { throw new Error('not sent'); }
    });
  }

  function showThanks(form) {
      var card = form.closest('.form-card');
      var name = (form.querySelector('[data-check="name"]').value || '').trim().split(' ')[0];
      card.innerHTML =
        '<div class="done">' +
          '<div class="tick" aria-hidden="true">&#10003;</div>' +
          '<h2>Thank you' + (name ? ', ' + escapeHtml(name) : '') + '.</h2>' +
          '<p>Your date is with us. Helen will look at the diary and come back to you personally ' +
             'with what is free and what it would cost.</p>' +
          '<p style="margin-bottom:0;">If you would rather not wait, ring her on ' +
             '<a href="tel:+447800787225">07800 787225</a>.</p>' +
        '</div>';
      card.setAttribute('role', 'status');
      card.setAttribute('tabindex', '-1');
      card.focus();
  }

  var carBox = document.getElementById('car-b');
  var carText = document.getElementById('car-b-text');
  var carBoxes = carBox ? carBox.querySelectorAll('input[type="checkbox"]') : [];
  function showCars() {
    var picked = [];
    Array.prototype.forEach.call(carBoxes, function (b) { if (b.checked) { picked.push(b.value); } });
    carText.textContent = picked.length ? picked.join(', ') : 'None selected';
  }
  Array.prototype.forEach.call(carBoxes, function (b) { b.addEventListener('change', showCars); });
  document.addEventListener('click', function (e) {
    if (carBox && carBox.open && !carBox.contains(e.target)) { carBox.open = false; }
  });

  var enquiry2 = document.getElementById('enquiry-2');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function chooseCar(card) {
    if (!carBox || !enquiry2) { return; }
    var want = card.getAttribute('data-car');
    Array.prototype.forEach.call(carBoxes, function (b) { if (b.value === want) { b.checked = true; } });
    showCars();
    enquiry2.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    var dateField = document.getElementById('date-b');
    setTimeout(function () { if (dateField) { dateField.focus({ preventScroll: true }); } }, reduce ? 0 : 500);
  }
  Array.prototype.forEach.call(document.querySelectorAll('.car[data-car]'), function (card) {
    card.addEventListener('click', function () { chooseCar(card); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseCar(card); }
    });
  });

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
