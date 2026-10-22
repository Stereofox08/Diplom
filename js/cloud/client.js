(function () {
  'use strict';
  var config = window.BYTESTORE_CLOUD;
  if (!config || !config.enabled) return;
  var BS = window.BS, db = BS.db, U = BS.util, auth = BS.auth;
  var cloud = BS.cloud = { enabled: true, pending: 0 };
  var session = U.storage.get('cloud-session', null), refreshing = null, loading = null;
  var chain = Promise.resolve(), lastRevision = 0;
  var personal = U.storage.get('cloud-personal', {carts:{}, favorites:{}});
  var aiDefaults = {enabled:true,provider:'OpenRouter',baseUrl:'https://openrouter.ai/api/v1',apiKey:'',model:'',failedModels:{},freeModels:[],temperature:0.4,maxTokens:1200,useFallback:true,autoSelect:true};

  function saveSession(value) {
    session = value;
    if (value) U.storage.set('cloud-session', value); else U.storage.remove('cloud-session');
    U.storage.remove(db.ADMIN_SESSION_KEY);
    if (value && value.user) U.storage.set(db.SESSION_KEY, {userId:value.user.id, name:value.user.user_metadata && value.user.user_metadata.name, ts:Date.now()});
    else U.storage.remove(db.SESSION_KEY);
  }
  async function request(path, options, retry) {
    options = options || {};
    if (session && session.expires_at * 1000 < Date.now() + 45000 && path.indexOf('/auth/v1/token') !== 0) await renew();
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 20000);
    try {
      var headers = Object.assign({apikey:config.key, 'Content-Type':'application/json'},options.headers || {});
      if (session && session.access_token && !options.noAuth) headers.Authorization = 'Bearer ' + session.access_token;
      var response = await fetch(config.url + path, {method:options.method || 'GET',headers:headers,body:options.body === undefined ? undefined : JSON.stringify(options.body),signal:controller.signal});
      var text = await response.text(), data;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
      if (response.status === 401 && session && !retry && path.indexOf('/auth/') !== 0) { await renew(); return request(path, options, true); }
      if (!response.ok) {
        var failure = new Error(data && (data.message || data.msg || data.error_description || data.error) || 'Сервис недоступен (' + response.status + ')');
        failure.status=response.status;
        throw failure;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('Нет связи с базой магазина. Проверьте интернет и повторите действие.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function renew() {
    if (!refreshing) refreshing = (async function () {
      try {
        var value = await request('/auth/v1/token?grant_type=refresh_token', {method:'POST',body:{refresh_token:session.refresh_token},noAuth:true},true);
        saveSession(value);
      } catch (error) {
        if(error.status===400 || error.status===401) { saveSession(null); throw new Error('Сессия завершилась. Войдите снова.'); }
        throw error;
      }
      finally { refreshing = null; }
    })();
    return refreshing;
  }
  function status(message, failed) {
    var element = document.getElementById('cloud-status');
    if (!element) {
      element = document.createElement('div'); element.id = 'cloud-status';
      element.setAttribute('role','status');
      element.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:10000;background:#111827;color:#fff;padding:10px 18px;border-radius:10px;box-shadow:0 4px 24px #0006;max-width:90vw';
      document.body.appendChild(element);
    }
    element.textContent = message; element.style.border = failed ? '1px solid #f87171' : '1px solid #22d3ee';
    element.hidden = !message;
  }
  function apply(state) {
    state.carts = personal.carts; state.favorites = personal.favorites;
    state.settings.ai = Object.assign({},aiDefaults,state.settings.ai);
    db.state = state; lastRevision = state.cloudRevision || 0;
    if (session) saveSession(session);
    window.dispatchEvent(new CustomEvent('bytestore:data'));
    return state;
  }
  cloud.refresh = async function () {
    if (!loading) loading = request('/rest/v1/rpc/store_snapshot', {method:'POST',body:{}}).then(apply).finally(function(){loading=null;});
    return loading;
  };
  // Mutations wait for the server. A failed request never displays success.
  function mutate(op, args) {
    cloud.pending++;
    status('Сохранение…');
    var work = chain.then(async function () {
      var result = await request('/rest/v1/rpc/store_command',{method:'POST',body:{op:op,args:args}});
      await cloud.refresh();
      if (op === 'likeReview') { var review = db.review(args[0]); return {liked:true,likes:review ? review.likes : 0}; }
      return result;
    });
    chain = work.catch(function(){});
    return work.catch(function(error){ status(error.message,true); throw error; }).finally(function(){
      cloud.pending--; if (!cloud.pending) setTimeout(function(){ if (!cloud.pending) status(''); },2500);
    });
  }
  db.init = function () {
    if (!db.ready) db.ready = acceptRedirect().then(cloud.refresh);
    return db.ready;
  };
  async function acceptRedirect() {
    var params=new URLSearchParams(location.hash.slice(1));
    if(!params.has('access_token')) return;
    var token=params.get('access_token'),refreshToken=params.get('refresh_token');
    history.replaceState(null,'',location.pathname+location.search);
    session={access_token:token,refresh_token:refreshToken,expires_at:Math.floor(Date.now()/1000)+Number(params.get('expires_in')||3600)};
    try { session.user=await request('/auth/v1/user'); saveSession(session); }
    catch(error){saveSession(null);throw error;}
  }
  db.save = function () {
    if (db.state) { personal = {carts:db.state.carts,favorites:db.state.favorites}; return U.storage.set('cloud-personal',personal); }
    return false;
  };
  db.isAdmin = function () { return !!(session && db.state && db.state.isAdmin); };
  db.adminSession = function () { return db.isAdmin() ? {login:db.state.admin.login, ts:Date.now()} : null; };
  db.resetDemo = function () { return Promise.reject(new Error('Сброс общей базы отключён.')); };
  ['saveProduct','deleteProduct','duplicateProduct','updateStock','saveCategory','deleteCategory','savePromo','deletePromo','setReviewStatus','updateReview','deleteReview','replyReview','likeReview','addReview','setOrderStatus','updateOrderComment','deleteOrder','setUserStatus','deleteUser','updateSettings','updateAiSettings'].forEach(function(name){
    db[name] = function () {
      var args=Array.prototype.slice.call(arguments);
      if(name==='saveProduct' && args[0].id && db.product(args[0].id)) args[0].revision=db.product(args[0].id).revision;
      if(name==='updateStock' && db.product(args[0])) args[2]=db.product(args[0]).revision;
      if(name==='updateAiSettings' && db.isAdmin()) Object.assign(db.state.settings.ai,args[0]);
      return mutate(name,args);
    };
  });
  db.createOrder = async function (data) {
    if (!auth.isLoggedIn()) return {ok:false,message:'Войдите в аккаунт для оформления заказа.'};
    var requestId = U.storage.get('checkout-request',null);
    if (!requestId) { requestId = crypto.randomUUID(); U.storage.set('checkout-request',requestId); }
    var payload = Object.assign({},data,{requestId:requestId,lines:db.cart().map(function(i){return {productId:i.productId,qty:i.qty};}),expectedTotal:db.cartTotals(null,data.promo).total});
    status('Оформление заказа…');
    try {
      var result = await request('/rest/v1/rpc/checkout',{method:'POST',body:{payload:payload}});
      await cloud.refresh();
      var order = db.order(result.orderId);
      db.clearCart(); U.storage.remove('checkout-request');
      status(''); return {ok:true,order:order,message:result.message};
    } catch(error) {
      // Refresh prices after rejection. Keep the idempotency key for safe retries.
      try { await cloud.refresh(); } catch(_) {}
      status(error.message,true); return {ok:false,message:error.message};
    }
  };
  // Editing the basket starts a new logical checkout attempt.
  ['addToCart','setCartQty','removeFromCart','clearCart'].forEach(function(name){
    var original = db[name];
    db[name] = function(){ U.storage.remove('checkout-request'); return original.apply(db,arguments); };
  });
  var originalTrack = db.track, originalVisit = db.visit;
  db.track = function(type,meta){ originalTrack(type,meta); };
  db.visit = function(){ originalVisit(); };

  auth.login = async function(email,password){
    try {
      var before = db.cartOwner();
      var value = await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:email,password:password},noAuth:true});
      saveSession(value); await cloud.refresh();
      db.transferCart(before,value.user.id);
      return {ok:true,user:auth.user(),message:'Вход выполнен'};
    } catch(error){ return {ok:false,message:error.message}; }
  };
  db.adminLogin = async function(email,password){
    var result = await auth.login(email,password);
    if (result.ok && !db.isAdmin()) return {ok:false,message:'У этой учётной записи нет доступа к админке.'};
    return result;
  };
  auth.register = async function(data){
    var errors = {};
    if (!String(data.name || '').trim()) errors.name='Укажите имя';
    if (auth.validateEmail(data.email)) errors.email=auth.validateEmail(data.email);
    if (auth.validatePhone(data.phone)) errors.phone=auth.validatePhone(data.phone);
    if (String(data.password || '').length<8) errors.password='Пароль должен содержать минимум 8 символов';
    if (data.password!==data.password2) errors.password2='Пароли не совпадают';
    if (!data.agree) errors.agree='Необходимо согласие с условиями';
    if(Object.keys(errors).length) return {ok:false,message:'Проверьте заполнение формы',errors:errors};
    try {
      var value=await request('/auth/v1/signup',{method:'POST',noAuth:true,body:{email:data.email,password:data.password,data:{name:data.name,phone:data.phone}}});
      if(value.access_token){saveSession(value);await cloud.refresh();return {ok:true,message:'Аккаунт создан'};}
      return {ok:true,pendingConfirmation:true,message:'Проверьте почту и подтвердите e-mail, затем войдите в магазин.'};
    }catch(error){return {ok:false,message:error.message};}
  };
  auth.logout = async function(){
    try { if(session) await request('/auth/v1/logout',{method:'POST'}); }
    finally { saveSession(null); await cloud.refresh(); }
    return true;
  };
  db.adminLogout = auth.logout;
  auth.updateProfile = async function(patch){
    if (patch.email && auth.user() && patch.email.toLowerCase()!==auth.user().email.toLowerCase()) return {ok:false,message:'Сменить e-mail можно через подтверждение нового адреса. Пока оставьте текущий.'};
    return mutate('updateProfile',[patch]);
  };
  auth.changePassword = async function(current,next,next2){
    if (next!==next2 || String(next).length<8) return {ok:false,message:'Пароли должны совпадать и содержать минимум 8 символов'};
    try {
      var check=await request('/auth/v1/token?grant_type=password',{method:'POST',noAuth:true,body:{email:auth.user().email,password:current}});
      saveSession(check);
      await request('/auth/v1/user',{method:'PUT',body:{password:next}});
      return {ok:true,message:'Пароль обновлён'};
    }catch(error){return {ok:false,message:error.message};}
  };
  db.changeAdminPassword=function(current,next){return auth.changePassword(current,next,next);};
  auth.demoAccounts=function(){return [];};
  auth.loginAsDemo=function(){return Promise.resolve({ok:false,message:'Демонстрационные аккаунты отключены.'});};

  var pollBusy=false;
  setInterval(async function(){
    if (!db.state || document.hidden || cloud.pending || pollBusy) return;
    if (document.querySelector('.modal-backdrop,.drawer-backdrop') || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    pollBusy=true;
    try {
      var rows=await request('/rest/v1/store_revision?select=version&id=eq.true');
      if(rows[0] && rows[0].version!==lastRevision){
        var adminPage=document.body.dataset.page==='admin';
        if(adminPage){
          var panel=document.querySelector('[data-admin-panel].is-active');
          await cloud.refresh();
          if(db.isAdmin() && panel) BS.admin.show(panel.dataset.adminPanel); else BS.admin.init();
        } else if(!['cart','login','register','account'].includes(document.body.dataset.page)) location.reload();
      }
    }catch(error){status('Нет связи с магазином. Повторная проверка выполняется автоматически.',true);}
    finally{pollBusy=false;}
  },15000);
  window.addEventListener('unhandledrejection',function(event){
    status(event.reason && event.reason.message || 'Не удалось сохранить изменения',true);
    event.preventDefault();
  });
  cloud.request=request;
  saveSession(session);
})();
