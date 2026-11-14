(function () {
  "use strict";

  const ORDERS_KEY = "northline-orders-v1";
  const INVOICES_KEY = "northline-invoices-v1";
  const TRANSACTIONS_KEY = "northline-transactions-v1";
  const PROJECTS_KEY = "northline-projects-v1";
  const TASKS_KEY = "northline-tasks-v1";
  const ACCOUNTS_KEY = "northline-client-accounts-v1";
  const SESSION_KEY = "northline-client-session-tab-v2";
  try { localStorage.removeItem("northline-client-session-v1"); } catch (_) {}

  function readSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (_) { return null; } }

  function writeSession(value) { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); return true; } catch (_) { return false; } }

  function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {} }

  const starterProjects = [
    {id:"p1",name:"Open Water",client:"Low Tide Films",service:"Video edit",status:"In review",due:"Nov 12, 2026",progress:78,initials:"LT",tone:"initials-blue"},
    {id:"p2",name:"Common Ground",client:"Jules Park",service:"Website",status:"In progress",due:"Nov 21, 2026",progress:56,initials:"CG",tone:"initials-sand"},
    {id:"p3",name:"Sunday Objects",client:"Sunday Objects",service:"Identity",status:"In progress",due:"Dec 04, 2026",progress:34,initials:"SO",tone:"initials-green"},
    {id:"p4",name:"Field Notes",client:"Samira Khan",service:"Mixed",status:"Planned",due:"Dec 16, 2026",progress:12,initials:"FN",tone:"initials-violet"}
  ];

  function readStore(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character];
    });
  }

  function statusSlug(status) {
    return String(status || "").toLowerCase().replace(/\s+/g, "-");
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, {month:"short",day:"2-digit",year:"numeric"});
  }

  function initialsFor(name) {
    return String(name || "").trim().split(/\s+/).map(function (part) { return part[0] || ""; }).join("").slice(0,2).toUpperCase() || "N";
  }

  const orderForm = document.getElementById("order-form");
  if (orderForm) {
    orderForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const formData = new FormData(orderForm);
      const orders = readStore(ORDERS_KEY, []);
      const clientName = String(formData.get("name") || "").trim();
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const order = {
        id:"NL-" + new Date().getFullYear() + "-" + Math.random().toString(36).slice(2,8).toUpperCase(),
        clientName:clientName,
        email:email,
        service:String(formData.get("service") || ""),
        brief:String(formData.get("brief") || "").trim(),
        createdAt:new Date().toISOString(),
        status:"Received"
      };
      orders.unshift(order);
      const message = document.getElementById("form-message");
      if (!writeStore(ORDERS_KEY, orders)) {
        if (message) message.textContent = "This browser could not save the request. Please email hello@northlinestudio.co.";
        return;
      }
      orderForm.reset();
      if (message) message.textContent = "Order request " + order.id + " received. Sign in to your client portal to follow its progress.";
      renderClientOrders();
    });

    const filters = document.querySelectorAll(".filter-chip");
    const cards = document.querySelectorAll(".project-card");
    filters.forEach(function (button) {
      button.addEventListener("click", function () {
        filters.forEach(function (item) { item.classList.remove("is-active"); });
        button.classList.add("is-active");
        const chosen = button.getAttribute("data-filter");
        cards.forEach(function (card) {
          card.hidden = chosen !== "all" && card.getAttribute("data-category") !== chosen;
        });
      });
    });

    const menuButton = document.querySelector(".menu-toggle");
    const nav = document.querySelector(".main-nav");
    if (menuButton && nav) {
      menuButton.addEventListener("click", function () {
        const open = nav.classList.toggle("is-open");
        menuButton.setAttribute("aria-expanded", String(open));
      });
      nav.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          nav.classList.remove("is-open");
          menuButton.setAttribute("aria-expanded", "false");
        });
      });
    }
  }

  initializeClientAccount();
  initializeClientPortal();

  window.addEventListener("storage", function (event) {
    if (event.key === ORDERS_KEY) { renderClientOrders(); renderPortalOrders(); }
    if (event.key === INVOICES_KEY || event.key === TRANSACTIONS_KEY) renderPortalInvoices();
  });
  function initializeClientAccount() {
    const form = document.getElementById("client-auth-form");
    if (!form) return;
    const nameField = document.getElementById("client-name-field");
    const nameInput = form.elements.clientName;
    const emailInput = form.elements.clientEmail;
    const passwordInput = form.elements.clientPassword;
    const authMessage = document.getElementById("auth-message");
    const submitButton = document.getElementById("client-auth-submit");
    let authMode = "login";

    document.querySelectorAll("[data-auth-mode]").forEach(function (button) {
      button.addEventListener("click", function () {
        authMode = button.getAttribute("data-auth-mode");
        document.querySelectorAll("[data-auth-mode]").forEach(function (item) { item.classList.toggle("is-active", item === button); });
        const isSignup = authMode === "signup";
        nameField.hidden = !isSignup;
        nameInput.required = isSignup;
        passwordInput.autocomplete = isSignup ? "new-password" : "current-password";
        submitButton.innerHTML = isSignup ? 'Create account <span>↗</span>' : 'Sign in <span>↗</span>';
        authMessage.textContent = "";
      });
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      authMessage.textContent = "";
      submitButton.disabled = true;
      try {
        if (!window.crypto || !window.crypto.subtle) throw new Error("Secure sign-in is available when the site is opened at localhost.");
        const email = String(emailInput.value || "").trim().toLowerCase();
        const password = String(passwordInput.value || "");
        const accounts = readStore(ACCOUNTS_KEY, []);
        let account;
        if (authMode === "signup") {
          if (accounts.some(function (item) { return item.email === email; })) throw new Error("An account with that email already exists. Sign in instead.");
          const salt = randomSalt();
          account = {email:email,name:String(nameInput.value || "").trim(),salt:salt,passwordHash:await hashPassword(password,salt)};
          accounts.push(account);
          if (!writeStore(ACCOUNTS_KEY, accounts)) throw new Error("This browser could not save your account.");
        } else {
          account = accounts.find(function (item) { return item.email === email; });
          if (!account) throw new Error("No client account was found for that email. Create one to get started.");
          if (await hashPassword(password,account.salt) !== account.passwordHash) throw new Error("That password does not match this account.");
        }
        if (!writeSession({email:account.email})) throw new Error("This browser could not start your client session.");
        form.reset();
        window.location.assign("client.html");
      } catch (error) {
        authMessage.textContent = error.message || "We could not sign you in. Please try again.";
      } finally {
        submitButton.disabled = false;
      }
    });

    const session = readSession();
    if (session && session.email) window.location.replace("client.html");
  }
  function randomSalt() {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes).map(function (byte) { return byte.toString(16).padStart(2,"0"); }).join("");
  }

  async function hashPassword(password, saltHex) {
    const salt = new Uint8Array((saltHex.match(/.{2}/g) || []).map(function (part) { return parseInt(part,16); }));
    const material = await window.crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
    const result = await window.crypto.subtle.deriveBits({name:"PBKDF2",salt:salt,iterations:100000,hash:"SHA-256"},material,256);
    return Array.from(new Uint8Array(result)).map(function (byte) { return byte.toString(16).padStart(2,"0"); }).join("");
  }

  function renderClientOrders() {
    const list = document.getElementById("client-order-list");
    if (!list) return;
    const session = readSession();
    const orders = readStore(ORDERS_KEY, []);
    const myOrders = session && session.email ? orders.filter(function (order) { return order.email.toLowerCase() === session.email; }) : [];
    if (!myOrders.length) {
      list.innerHTML = '<p class="client-no-orders">No project requests yet. When you place one, it will appear here.</p>';
      return;
    }
    list.innerHTML = myOrders.map(function (order) {
      return '<article class="client-order-card"><div class="client-order-card-top"><strong>' + escapeHtml(order.id) + '</strong><span class="client-order-status" data-status="' + statusSlug(order.status) + '">' + escapeHtml(order.status) + '</span></div><h4>' + escapeHtml(order.service) + '</h4><p>' + escapeHtml(order.brief) + '</p><small>Placed ' + escapeHtml(formatDate(order.createdAt)) + '</small></article>';
    }).join("");
  }

  function initializeClientPortal() {
    const portal = document.getElementById("client-portal");
    if (!portal) return;
    const session = readSession();
    const account = session && session.email ? readStore(ACCOUNTS_KEY, []).find(function (item) { return item.email === session.email; }) : null;
    if (!account) { clearSession(); window.location.replace("index.html#client-login"); return; }
    document.getElementById("portal-client-name").textContent = account.name || account.email;
    document.getElementById("portal-client-email").textContent = account.email;
    document.getElementById("client-sign-out").addEventListener("click", function () { clearSession(); window.location.assign("index.html#client-login"); });
    const requestForm = document.getElementById("client-request-form");
    const requestMessage = document.getElementById("client-request-message");
    requestForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const data = new FormData(requestForm);
      const orders = readStore(ORDERS_KEY, []);
      const order = {id:"NL-" + new Date().getFullYear() + "-" + Math.random().toString(36).slice(2,8).toUpperCase(),clientName:account.name || account.email,email:account.email,title:String(data.get("title") || "").trim(),service:String(data.get("service") || ""),brief:String(data.get("brief") || "").trim(),timeline:String(data.get("timeline") || ""),createdAt:new Date().toISOString(),status:"Received"};
      orders.unshift(order);
      if (!writeStore(ORDERS_KEY, orders)) { requestMessage.textContent = "This browser could not save your request. Please email hello@northlinestudio.co."; return; }
      requestForm.reset();
      requestMessage.textContent = "Request " + order.id + " is in the studio inbox.";
      renderPortalOrders();
    });
    document.querySelectorAll("[data-project-filter]").forEach(function (button) { button.addEventListener("click", function () { document.querySelectorAll("[data-project-filter]").forEach(function (item) { item.classList.toggle("is-active", item === button); }); renderPortalOrders(button.getAttribute("data-project-filter")); }); });
    renderPortalOrders();
    initializeClientPayments();
    renderPortalInvoices(account);
  }

  function renderPortalOrders(filter) {
    const list = document.getElementById("portal-project-list");
    if (!list) return;
    const session = readSession();
    const orders = readStore(ORDERS_KEY, []).filter(function (order) { return session && order.email && order.email.toLowerCase() === session.email; });
    const active = orders.filter(function (order) { return order.status !== "Complete" && order.status !== "Declined"; });
    const completed = orders.filter(function (order) { return order.status === "Complete"; });
    document.getElementById("portal-active-count").textContent = String(active.length).padStart(2,"0");
    document.getElementById("portal-complete-count").textContent = String(completed.length).padStart(2,"0");
    document.getElementById("portal-total-count").textContent = String(orders.length).padStart(2,"0");
    const currentFilter = filter || (document.querySelector("[data-project-filter].is-active") || {}).dataset?.projectFilter || "all";
    const visible = orders.filter(function (order) { return currentFilter === "all" || (currentFilter === "active" ? order.status !== "Complete" && order.status !== "Declined" : order.status === "Complete"); });
    if (!visible.length) { list.innerHTML = '<div class="portal-empty"><span>✳</span><h3>' + (orders.length ? "No projects in this view yet." : "Your story starts here.") + '</h3><p>' + (orders.length ? "Try another filter or send the studio a new request." : "Send a project request and your timeline will appear here.") + '</p></div>'; return; }
    list.innerHTML = visible.map(function (order) { return '<article class="portal-project-card"><div class="portal-project-top"><span class="portal-project-id">' + escapeHtml(order.id) + ' · ' + escapeHtml(formatDate(order.createdAt)) + '</span><span class="client-order-status" data-status="' + statusSlug(order.status) + '">' + escapeHtml(order.status) + '</span></div><h3>' + escapeHtml(order.title || order.service) + '</h3><p class="portal-project-service">' + escapeHtml(order.service) + (order.timeline ? ' · ' + escapeHtml(order.timeline) : '') + '</p><p class="portal-project-brief">' + escapeHtml(order.brief) + '</p>' + (order.status === "Complete" ? '<div class="portal-completed-note">Completed work · saved in your project history</div>' : '') + '</article>'; }).join("");
  }
  function formatInr(amount) {
    return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(amount) || 0);
  }

  function initializeClientPayments() {
    const select=document.getElementById("client-invoice-select"),list=document.getElementById("portal-invoice-list"),custom=document.getElementById("client-payment-custom");
    if(!select||!list||!custom)return;
    select.addEventListener("change",function(){
      custom.value="";
      document.querySelector("input[name='payment-choice'][value='deposit']").checked=true;
      syncInvoiceSelection();
      updateClientPaymentQuote();
    });
    document.querySelectorAll("input[name='payment-choice']").forEach(function(input){input.addEventListener("change",updateClientPaymentQuote);});
    custom.addEventListener("input",function(){document.querySelector("input[name='payment-choice'][value='custom']").checked=true;updateClientPaymentQuote();});
    list.addEventListener("click",function(event){
      const button=event.target.closest("[data-invoice-pick]");
      if(button)selectClientInvoice(button.getAttribute("data-invoice-pick"));
    });
  }

  function selectClientInvoice(invoiceId) {
    const select=document.getElementById("client-invoice-select");
    const session=readSession();
    const invoice=readStore(INVOICES_KEY,[]).find(function(item){return item.id===invoiceId&&session&&item.email.toLowerCase()===session.email;});
    if(!select||!invoice)return;
    select.value=invoice.id;
    if(select.value!==invoice.id)return;
    document.getElementById("client-payment-custom").value="";
    document.querySelector("input[name='payment-choice'][value='deposit']").checked=true;
    syncInvoiceSelection();
    updateClientPaymentQuote();
    document.querySelector(".portal-payment-box").scrollIntoView({behavior:"smooth",block:"center"});
  }

  function syncInvoiceSelection() {
    const select=document.getElementById("client-invoice-select");
    if(!select)return;
    document.querySelectorAll("[data-invoice-pick]").forEach(function(button){
      const selected=button.getAttribute("data-invoice-pick")===select.value;
      button.textContent=selected?"Selected":"Choose invoice";
      button.setAttribute("aria-pressed",String(selected));
      const card=button.closest(".portal-invoice-card");
      if(card)card.classList.toggle("is-selected",selected);
    });
  }

  function renderPortalInvoices(account) {
    const list=document.getElementById("portal-invoice-list");
    if(!list)return;
    const session=readSession(),email=(account&&account.email)||(session&&session.email)||"";
    const invoices=readStore(INVOICES_KEY,[]).filter(function(invoice){return invoice.email.toLowerCase()===email;});
    const select=document.getElementById("client-invoice-select");
    if(!invoices.length){
      select.innerHTML='<option value="">No invoices available</option>';
      list.innerHTML='<div class="portal-empty"><span>₹</span><h3>No invoices yet.</h3><p>The studio will add your project charge here when your scope is confirmed.</p></div>';
    }else{
      const previousValue=select.value;
      select.innerHTML=invoices.map(function(invoice){const balance=Math.max(0,Number(invoice.amount)-Number(invoice.paid||0));return '<option value="'+escapeHtml(invoice.id)+'">'+escapeHtml(invoice.project)+' · '+formatInr(balance)+' due</option>';}).join("");
      select.value=invoices.some(function(invoice){return invoice.id===previousValue;})?previousValue:invoices[0].id;
      list.innerHTML=invoices.map(function(invoice){const amount=Number(invoice.amount)||0,paid=Number(invoice.paid)||0,balance=Math.max(0,amount-paid),status=balance===0?"Paid":paid>0?"Partially paid":"Awaiting payment";return '<article class="portal-invoice-card" data-invoice-card="'+escapeHtml(invoice.id)+'"><div><p class="portal-project-id">'+escapeHtml(invoice.id)+' · '+escapeHtml(formatDate(invoice.createdAt))+'</p><h3>'+escapeHtml(invoice.project)+'</h3><p>'+escapeHtml(status)+'</p></div><div class="portal-invoice-amount"><strong>'+formatInr(balance)+'</strong><small>of '+formatInr(amount)+' remaining</small></div><button type="button" data-invoice-pick="'+escapeHtml(invoice.id)+'" aria-pressed="false">Choose invoice</button></article>';}).join("");
    }
    syncInvoiceSelection();
    updateClientPaymentQuote();
  }
  function updateClientPaymentQuote() {
    const select=document.getElementById("client-invoice-select");
    if (!select) return;
    const invoices=readStore(INVOICES_KEY,[]);
    const invoice=invoices.find(function (item) { return item.id===select.value; });
    const button=document.getElementById("client-pay-button");
    const message=document.getElementById("client-payment-message");
    if (!invoice) {
      document.getElementById("client-payment-title").textContent="Select an invoice";
      document.getElementById("client-payment-balance").textContent="Your invoices will appear here.";
      document.getElementById("client-payment-deposit").textContent=formatInr(0);
      document.getElementById("client-payment-full").textContent=formatInr(0);
      document.getElementById("client-payment-selected").textContent=formatInr(0);
      button.disabled=true;
      message.textContent="Secure checkout will be enabled after the studio connects its Paytm or PhonePe merchant account.";
      return;
    }
    const session=readSession();
    if (!session || invoice.email.toLowerCase()!==session.email) { button.disabled=true; return; }
    const total=Number(invoice.amount)||0, paid=Number(invoice.paid)||0, balance=Math.max(0,total-paid);
    const minimum=Math.min(balance,Math.ceil(total*20-1e-8)/100);
    document.getElementById("client-payment-title").textContent=invoice.project;
    document.getElementById("client-payment-balance").textContent=formatInr(paid)+" paid · "+formatInr(balance)+" remaining";
    document.getElementById("client-payment-minimum").textContent="Minimum advance · "+formatInr(minimum);
    document.getElementById("client-payment-deposit").textContent=formatInr(minimum);
    document.getElementById("client-payment-full").textContent=formatInr(balance);
    const custom=document.getElementById("client-payment-custom");
    custom.min=String(minimum); custom.max=String(balance);
    const choice=document.querySelector("input[name='payment-choice']:checked").value;
    const selected=choice==="full"?balance:choice==="custom"?Number(custom.value)||0:minimum;
    document.getElementById("client-payment-selected").textContent=formatInr(selected);
    const valid=balance>0 && selected>=minimum && selected<=balance;
    button.disabled=true;
    message.textContent=balance===0?"This invoice is fully paid.":!valid && choice==="custom"?"Enter an advance of at least "+formatInr(minimum)+" and no more than the remaining balance.":"Secure checkout is not connected yet. Choose Paytm or PhonePe and connect the studio merchant account to accept payments.";
  }
  if (!document.body.hasAttribute("data-admin")) return;
  const adminViewNames = {overview:"Overview",projects:"Projects",orders:"Orders",transactions:"Transactions"};
  function updateAdminView() {
    const requested = window.location.hash.slice(1);
    const current = Object.prototype.hasOwnProperty.call(adminViewNames,requested) ? requested : "overview";
    document.body.setAttribute("data-admin-current",current);
    document.querySelectorAll("[data-admin-view]").forEach(function (view) { view.hidden = view.getAttribute("data-admin-view") !== current; });
    document.querySelectorAll(".admin-nav-link[href^='#']").forEach(function (link) {
      const active = link.getAttribute("href") === "#" + current;
      link.classList.toggle("is-current",active);
      if (active) link.setAttribute("aria-current","page"); else link.removeAttribute("aria-current");
    });
    const breadcrumb = document.getElementById("admin-breadcrumb");
    if (breadcrumb) breadcrumb.innerHTML = "Workspace <span>/</span> " + adminViewNames[current];
    if (requested) window.scrollTo(0,0);
  }
  window.addEventListener("hashchange",updateAdminView);
  updateAdminView();


  let projects = readStore(PROJECTS_KEY, starterProjects);
  let orders = readStore(ORDERS_KEY, []);
  let invoices = readStore(INVOICES_KEY, []);
  let transactions = readStore(TRANSACTIONS_KEY, []);

  function renderProjects() {
    const tbody=document.getElementById("project-rows");
    if(!tbody)return;
    const query=(document.getElementById("project-search").value||"").trim().toLowerCase();
    const visibleProjects=projects.filter(function(project){return (project.client+" "+project.name+" "+project.service+" "+project.status).toLowerCase().includes(query);});
    if(query)visibleProjects.sort(function(a,b){return a.client.localeCompare(b.client)||a.name.localeCompare(b.name);});
    tbody.innerHTML=visibleProjects.map(function(project){
      const initials=project.initials||initialsFor(project.client);
      const choices=["In progress","In review","Planned","Complete"].map(function(status){return "<option"+(project.status===status?" selected":"")+">"+status+"</option>";}).join("");
      const progress=Math.max(0,Math.min(100,Number(project.progress)||0));
      const tone=project.tone||"initials-green",cssStatus=statusSlug(project.status);
      return '<tr><td class="project-name">'+escapeHtml(project.name)+'</td><td><span class="client-cell"><span class="client-initials '+escapeHtml(tone)+'">'+escapeHtml(initials)+'</span>'+escapeHtml(project.client)+'</span></td><td>'+escapeHtml(project.service)+'</td><td><select class="status-select" data-project="'+escapeHtml(project.id)+'" data-status="'+cssStatus+'" aria-label="Project status for '+escapeHtml(project.name)+'">'+choices+'</select></td><td class="due-cell">'+escapeHtml(project.due)+'</td><td><span class="progress-cell"><span class="progress-track"><i style="width:'+progress+'%"></i></span><span>'+progress+'%</span></span></td></tr>';
    }).join("");
    document.getElementById("visible-project-count").textContent=String(visibleProjects.length);
    document.getElementById("project-nav-count").textContent=String(projects.length).padStart(2,"0");
    const active=projects.filter(function(project){return project.status!=="Complete";}).length;
    document.getElementById("active-project-count").textContent=String(active).padStart(2,"0");
  }
  function renderOrders() {
    const tbody = document.getElementById("order-rows");
    if (!tbody) return;
    const query = (document.getElementById("order-search").value || "").toLowerCase().trim();
    const filter = document.getElementById("order-filter").value;
    const visible = orders.filter(function (order) {
      const searchText = (order.id + " " + order.clientName + " " + order.email + " " + order.service + " " + order.brief).toLowerCase();
      return searchText.includes(query) && (filter === "all" || order.status === filter);
    });
    const statuses = ["Received","In review","In progress","Complete","Declined"];
    if (!visible.length) {
      const message = orders.length ? "No orders match those filters." : "No orders yet. Client project requests will show up here.";
      tbody.innerHTML = '<tr><td colspan="6" class="order-empty">' + message + '</td></tr>';
    } else {
      tbody.innerHTML = visible.map(function (order) {
        const initials = initialsFor(order.clientName);
        const choices = statuses.map(function (status) {
          return "<option" + (order.status === status ? " selected" : "") + ">" + status + "</option>";
        }).join("");
        return '<tr><td><strong class="order-reference">' + escapeHtml(order.id) + '</strong></td><td><span class="client-cell"><span class="client-initials initials-rose">' + escapeHtml(initials) + '</span><span class="order-client"><strong>' + escapeHtml(order.clientName) + '</strong><small>' + escapeHtml(order.email) + '</small></span></span></td><td>' + escapeHtml(order.service) + '</td><td><select class="order-status" data-order="' + escapeHtml(order.id) + '" data-status="' + statusSlug(order.status) + '" aria-label="Order status for ' + escapeHtml(order.id) + '">' + choices + '</select></td><td class="due-cell">' + escapeHtml(formatDate(order.createdAt)) + '</td><td><span class="order-brief" title="' + escapeHtml(order.brief) + '">' + escapeHtml(order.brief) + '</span></td></tr>';
      }).join("");
    }

    const openCount = orders.filter(function (order) { return order.status !== "Complete" && order.status !== "Declined"; }).length;
    const newCount = orders.filter(function (order) { return order.status === "Received"; }).length;
    const completeCount = orders.filter(function (order) { return order.status === "Complete"; }).length;
    document.getElementById("open-order-count").textContent = String(openCount).padStart(2,"0");
    document.getElementById("order-nav-count").textContent = String(newCount).padStart(2,"0");
    document.getElementById("order-footline").textContent = orders.length ? newCount + " new · " + completeCount + " completed" : "No orders yet";
    document.getElementById("visible-order-count").textContent = String(visible.length);
  }

  function renderTransactions() {
    const invoiceRows=document.getElementById("invoice-rows");
    if (!invoiceRows) return;
    invoices=readStore(INVOICES_KEY,[]); transactions=readStore(TRANSACTIONS_KEY,[]);
    const collected=invoices.reduce(function(sum,item){return sum+(Number(item.paid)||0);},0);
    const invoiced=invoices.reduce(function(sum,item){return sum+(Number(item.amount)||0);},0);
    document.getElementById("finance-invoiced-total").textContent=formatInr(invoiced);
    document.getElementById("finance-collected-total").textContent=formatInr(collected);
    document.getElementById("finance-outstanding-total").textContent=formatInr(Math.max(0,invoiced-collected));
    document.getElementById("finance-transaction-count").textContent=String(transactions.length).padStart(2,"0");
    document.getElementById("transaction-nav-count").textContent=String(transactions.length).padStart(2,"0");
    invoiceRows.innerHTML=invoices.length?invoices.map(function(invoice){const amount=Number(invoice.amount)||0,paid=Number(invoice.paid)||0,balance=Math.max(0,amount-paid),status=balance===0?"Paid":paid>0?"Partially paid":"Open";return '<tr><td><strong class="order-reference">'+escapeHtml(invoice.id)+'</strong></td><td><span class="order-client"><strong>'+escapeHtml(invoice.clientName)+'</strong><small>'+escapeHtml(invoice.email)+'</small><small>'+escapeHtml(invoice.project)+'</small></span></td><td>'+formatInr(amount)+'</td><td>'+formatInr(paid)+'</td><td>'+formatInr(balance)+'</td><td><span class="finance-status" data-status="'+statusSlug(status)+'">'+status+'</span></td></tr>';}).join(""):'<tr><td colspan="6" class="finance-empty">No client charges yet. Create an invoice to begin.</td></tr>';
    const manualSelect=document.getElementById("manual-invoice-select");
    const openInvoices=invoices.filter(function(invoice){return Number(invoice.amount)>Number(invoice.paid||0);});
    manualSelect.innerHTML='<option value="" disabled selected>Select an invoice</option>'+openInvoices.map(function(invoice){return '<option value="'+escapeHtml(invoice.id)+'">'+escapeHtml(invoice.clientName)+' · '+escapeHtml(invoice.project)+' · '+formatInr(Number(invoice.amount)-Number(invoice.paid||0))+' due</option>';}).join("");
    const rows=document.getElementById("transaction-rows");
    rows.innerHTML=transactions.length?transactions.slice().sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);}).map(function(transaction){return '<tr><td>'+escapeHtml(formatDate(transaction.createdAt))+'</td><td><strong class="order-reference">'+escapeHtml(transaction.reference||transaction.id)+'</strong></td><td><span class="order-client"><strong>'+escapeHtml(transaction.clientName)+'</strong><small>'+escapeHtml(transaction.email)+'</small><small>'+escapeHtml(transaction.project)+'</small></span></td><td>'+escapeHtml(transaction.method)+'</td><td>'+formatInr(transaction.amount)+'</td><td><span class="finance-status" data-status="'+statusSlug(transaction.status)+'">'+escapeHtml(transaction.status)+'</span></td><td>'+escapeHtml(transaction.source)+'</td></tr>';}).join(""):'<tr><td colspan="7" class="finance-empty">Transactions will appear here when a client pays or the studio records a payment.</td></tr>';
  }

  document.getElementById("invoice-form").addEventListener("submit",function(event){
    event.preventDefault(); const form=event.currentTarget,data=new FormData(form),amount=Number(data.get("amount")),email=String(data.get("email")||"").trim().toLowerCase();
    if (!(amount>0)) return;
    const invoice={id:"NL-INV-"+new Date().getFullYear()+"-"+Math.random().toString(36).slice(2,7).toUpperCase(),clientName:String(data.get("clientName")||"").trim(),email:email,project:String(data.get("project")||"").trim(),amount:amount,paid:0,currency:"INR",createdAt:new Date().toISOString(),status:"Open"};
    invoices.unshift(invoice); if(!writeStore(INVOICES_KEY,invoices)){document.getElementById("invoice-message").textContent="Could not save the invoice in this browser.";return;}
    form.reset();document.getElementById("invoice-message").textContent="Invoice "+invoice.id+" added to the client space.";renderTransactions();
  });
  document.getElementById("manual-transaction-form").addEventListener("submit",function(event){
    event.preventDefault();const form=event.currentTarget,data=new FormData(form),invoice=invoices.find(function(item){return item.id===data.get("invoiceId");}),amount=Number(data.get("amount"));
    if(!invoice||!(amount>0)){return;}const balance=Number(invoice.amount)-Number(invoice.paid||0);
    if(amount>balance){document.getElementById("transaction-message").textContent="The entry is larger than this invoice’s remaining balance.";return;}
    const transaction={id:"NL-TX-"+Date.now(),invoiceId:invoice.id,clientName:invoice.clientName,email:invoice.email,project:invoice.project,amount:amount,currency:"INR",method:String(data.get("method")||"Other"),reference:String(data.get("reference")||"").trim(),status:"Completed",source:"Manual entry",createdAt:new Date().toISOString()};
    transactions.unshift(transaction);invoice.paid=Number(invoice.paid||0)+amount;invoice.status=invoice.paid>=invoice.amount?"Paid":"Partially paid";
    if(!writeStore(TRANSACTIONS_KEY,transactions)||!writeStore(INVOICES_KEY,invoices)){document.getElementById("transaction-message").textContent="Could not save this transaction in the browser.";return;}
    form.reset();document.getElementById("transaction-message").textContent="Payment recorded and the client invoice is updated.";renderTransactions();
  });
  document.getElementById("project-search").addEventListener("input",renderProjects);
  document.getElementById("project-rows").addEventListener("change", function (event) {
    const select = event.target.closest(".status-select");
    if (!select) return;
    const project = projects.find(function (item) { return item.id === select.getAttribute("data-project"); });
    if (!project) return;
    project.status = select.value;
    if (project.status === "Complete") project.progress = 100;
    writeStore(PROJECTS_KEY, projects);
    renderProjects();
  });

  document.getElementById("order-search").addEventListener("input", renderOrders);
  document.getElementById("order-filter").addEventListener("change", renderOrders);
  document.getElementById("order-rows").addEventListener("change", function (event) {
    const select = event.target.closest(".order-status");
    if (!select) return;
    const order = orders.find(function (item) { return item.id === select.getAttribute("data-order"); });
    if (!order) return;
    order.status = select.value;
    writeStore(ORDERS_KEY, orders);
    renderOrders();
  });

  const tasks = Array.from(document.querySelectorAll(".rhythm-task input"));
  const taskState = readStore(TASKS_KEY,[false,false,false,false]);
  function updateTaskProgress() {
    const done = tasks.filter(function (input) { return input.checked; }).length;
    document.getElementById("task-progress-label").textContent = done + " / " + tasks.length + " done";
    document.getElementById("task-progress-bar").style.width = (tasks.length ? done / tasks.length * 100 : 0) + "%";
  }
  tasks.forEach(function (input,index) {
    input.checked = Boolean(taskState[index]);
    input.addEventListener("change",function () {
      taskState[index] = input.checked;
      writeStore(TASKS_KEY,taskState);
      updateTaskProgress();
    });
  });

  const dialog = document.getElementById("project-dialog");
  document.getElementById("new-project-button").addEventListener("click",function () {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open","");
  });
  document.getElementById("dialog-close").addEventListener("click",function () { dialog.close(); });
  document.getElementById("dialog-cancel").addEventListener("click",function () { dialog.close(); });
  document.getElementById("project-form").addEventListener("submit",function (event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const client = String(data.get("client") || "").trim();
    const dueRaw = String(data.get("due") || "");
    const due = dueRaw ? new Date(dueRaw + "T12:00:00").toLocaleDateString(undefined,{month:"short",day:"2-digit",year:"numeric"}) : "TBD";
    projects.unshift({id:"p" + Date.now(),name:name,client:client,service:String(data.get("service") || ""),status:"Planned",due:due,progress:0,initials:initialsFor(client),tone:"initials-rose"});
    writeStore(PROJECTS_KEY,projects);
    renderProjects();
    form.reset();
    dialog.close();
  });

  document.getElementById("all-projects-link").addEventListener("click",function () {
    document.getElementById("project-search").value="";
    renderProjects();
    document.getElementById("project-rows").scrollIntoView({behavior:"smooth",block:"center"});
  });

  window.addEventListener("storage",function (event) {
    if (event.key === ORDERS_KEY) {
      orders = readStore(ORDERS_KEY, []);
      renderOrders();
    }
    if (event.key === INVOICES_KEY || event.key === TRANSACTIONS_KEY) { invoices=readStore(INVOICES_KEY,[]); transactions=readStore(TRANSACTIONS_KEY,[]); renderTransactions(); }
    if (event.key === PROJECTS_KEY) {
      projects = readStore(PROJECTS_KEY, starterProjects);
      renderProjects();
    }
  });

  renderProjects();
  renderOrders();
  renderTransactions();
  updateTaskProgress();
})();
