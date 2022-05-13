/*!
  By AndrÃ© Rinas, www.andrerinas.de
  Documentation, www.simplelightbox.de
  Available for use under the MIT License
  1.17.3
*/
;(function($, window, document, undefined) {
'use strict';

$.fn.simpleLightbox = function(options) {

var options = $.extend({
  sourceAttr: 'href',
  overlay: true,
  spinner: true,
  nav: true,
  navText: ['&lsaquo;', '&rsaquo;'],
  captions: true,
  captionDelay: 0,
  captionSelector: 'img',
  captionType: 'attr',
  captionsData: 'title',
  captionPosition: 'bottom',
  captionClass: '',
  close: true,
  closeText: '&times;',
  swipeClose: true,
  showCounter: true,
  fileExt: 'mp3|mp4|webp|epub|pdf|png|jpg|jpeg|gif',
  animationSlide: true,
  animationSpeed: 250,
  preloading: true,
  enableKeyboard: true,
  loop: true,
  rel: false,
  docClose: true,
  swipeTolerance: 50,
  className: 'simple-lightbox',
  widthRatio: 0.85,
  heightRatio: 0.85,
  scaleImageToRatio: false,
  disableRightClick: false,
  disableScroll: true,
  alertError: true,
  alertErrorMessage: 'Image not found, next image will be loaded',
  additionalHtml: false,
  history: true,
  throttleInterval: 0,
  doubleTapZoom: 2,
  maxZoom: 10,
  htmlClass: 'has-lightbox'
}, options);


var transPrefix = function() {
  var s = document.body || document.documentElement;
  s = s.style;
  if (s.WebkitTransition === '') return '-webkit-';
  if (s.MozTransition === '') return '-moz-';
  if (s.OTransition === '') return '-o-';
  if (s.transition === '') return '';
  return false;
};


// global variables
var winLoc = window.location;
var getHash = function() {  return winLoc.hash.substring(1); };
var initialHash = getHash();
var touchDevice = ( 'ontouchstart' in window);
var pointerEnabled = window.navigator.pointerEnabled || window.navigator.msPointerEnabled;
var swipeDiff = 0;
var swipeYDiff = 0;
var curImg = $();
var opened = false;
var loaded = [];
var objects = (options.rel && options.rel !== false) ? getRelated(options.rel, $(this)) : this;
var tagname = "A" //objects.get()[0].tagName;
var transPrefix = transPrefix();
var globalScrollbarwidth = 0;
var canTransisions = (transPrefix !== false) ? true : false;
var supportsPushState = ('pushState' in history);
var historyhasChanged = false;
var historyUpdateTimeout;
var prefix = 'simplelb';
var overlay = $('<div>').addClass('sl-overlay');
var closeBtn = $('<button>').addClass('sl-close').html(options.closeText);
var spinner = $('<div>').addClass('sl-spinner').html('<div></div>');
var nav = $('<div>').addClass('sl-navigation').html('<button class="sl-prev">'+options.navText[0]+'</button><button class="sl-next">'+options.navText[1]+'</button>');
var counter = $('<div>').addClass('sl-counter').html('<span class="sl-current"></span>/<span class="sl-total"></span>');
var animating = false;
var index = 0;
var startIndex = 0;
var caption = $('<div>').addClass('sl-caption '+options.captionClass+' pos-'+options.captionPosition);
var image = $('<div>').addClass('sl-image');
var wrapper = $('<div>').addClass('sl-wrapper').addClass(options.className);
var tmpImage;
var windowWidth;
var windowHeight;
var dir;


// Functions
var touched = function(event) {
  if( touchDevice ) return true;
  if( !pointerEnabled || typeof event === 'undefined' || typeof event.pointerType === 'undefined' ) return false;
  if( typeof event.MSPOINTER_TYPE_MOUSE !== 'undefined' ) {
    if( event.MSPOINTER_TYPE_MOUSE != event.pointerType ) return true;
  } else {
    if (event.pointerType != 'mouse') return true;
  }
  return false;
};


var getRelated = function(rel, jqObj) {
  var $related = jqObj.filter(function () {
    return ($(this).attr('rel') === rel);
  });
  return $related;
};


var updateHash = function(){
  var hash = getHash(),
  newHash = 'pid='+(index+1);
  var newURL = winLoc.href.split('#')[0] + '#' + newHash;
  if(supportsPushState) {
    history[historyhasChanged ? 'replaceState' : 'pushState']('', document.title, newURL);
  } else {
    if(historyhasChanged) {
      winLoc.replace( newURL );
    } else {
      winLoc.hash = newHash;
    }
  }
  historyhasChanged = true;
};

var resetHash = function() {
  if (supportsPushState) {
    history.pushState('', document.title, winLoc.pathname + winLoc.search );
  } else {
    winLoc.hash = '';
  }
  clearTimeout(historyUpdateTimeout);
};

var updateURL = function() {
  if (!historyhasChanged) {
    updateHash(); // first time
  } else {
    historyUpdateTimeout = setTimeout(updateHash, 800);
  }
};

var throttle = function(func, limit) {
  var inThrottle;
  return function() {
    var args = arguments;
    var context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(function() { return inThrottle = false; }, limit);
    }
  };
};


var isValidLink = function(element) {
  if (!options.fileExt) return true;
  var filEext = /\.([0-9a-z]+)(?=[?#])|(\.)(?:[\w]+)$/gmi;
  var testExt = $( element ).attr("title").match(filEext);
  return testExt && $(element).prop('tagName').toUpperCase() == tagname && (new RegExp( '\.(' + options.fileExt + ')$', 'i' )).test(testExt);
};


var setup = function() {
  if (options.close) closeBtn.appendTo(wrapper);
  if (options.showCounter) {
    if (objects.length > 1) {
      counter.appendTo(wrapper);
      counter.find('.sl-total').text(objects.length);
    }
  }
  if (options.nav) nav.appendTo(wrapper);
  if (options.spinner) spinner.appendTo(wrapper);
};


var openImage = function(elem) {
  elem.trigger($.Event('show.simplelightbox'));
  if (options.disableScroll) globalScrollbarwidth = handleScrollbar('hide');
  if (options.htmlClass && options.htmlClass != '') $('html').addClass(options.htmlClass);
  wrapper.appendTo('body');
  image.appendTo(wrapper);
  if (options.overlay) overlay.appendTo($('body'));
  animating = true;
  index = objects.index(elem);
  if ($(elem).attr("type").startsWith("image")) {
    curImg = $('<img/>')
      .hide()
      .attr('src', elem.attr(options.sourceAttr))
      .attr('mtype', 'image')
      .attr('data-scale', 1)
      .attr('data-translate-x', 0)
      .attr('data-translate-y', 0);
  } else if ($(elem).attr("type").startsWith("audio")) {
    curImg = $('<audio></audio>')
      .hide()
      .attr('src', elem.attr(options.sourceAttr))
      .attr('mtype', 'audio')
      .prop('controls', true)
      .prop('autoplay', true);
  } else if ($(elem).attr("type").startsWith("video")) {
    curImg = $('<video></video>')
      .hide()
      .attr('src', elem.attr(options.sourceAttr))
      .attr('mtype', 'video')
      .attr('data-scale', 1)
      .attr('data-translate-x', 0)
      .attr('data-translate-y', 0)
      .prop('controls', true)
      .prop('autoplay', true);
  } else if ($(elem).attr("type").endsWith("pdf")) {
    curImg = $('<iframe id="pdf_iframe"></iframe>')
      .hide()
      .attr('src', elem.attr(options.sourceAttr))
      .attr('mtype', 'pdf')
      .attr('scrolling', 'no')
      .attr('data-scale', 1)
      .attr('data-translate-x', 0)
      .attr('data-translate-y', 0);
  } else if ($(elem).attr("type").endsWith("pub+zip")) {
    curImg = $('<iframe id="epub_iframe"></frame>')
      .hide()
      .attr('src', "/epub_reader/?epub=" + elem.attr(options.sourceAttr))
      .attr('mtype', 'epub')
      .attr('scrolling', 'no')
      .attr('data-scale', 1)
      .attr('data-translate-x', 0)
      .attr('data-translate-y', 0);
  }
  if (loaded.indexOf(elem.attr(options.sourceAttr)) == -1) {
     loaded.push(elem.attr(options.sourceAttr));
  }
  curImg.appendTo(image);
  addEvents();
  overlay.fadeIn('fast');
  $('.sl-close').fadeIn('fast');
  spinner.show();
  nav.fadeIn('fast');
  $('.sl-wrapper .sl-counter .sl-current').text(index +1);
  counter.fadeIn('fast');
  adjustImage();
  if (options.preloading) { preload(); }
  setTimeout( function() { elem.trigger($.Event('shown.simplelightbox')); }, options.animationSpeed);
};


var adjustImage = function(direction) {
  dir = direction;
  if(!curImg.length) return;
  windowWidth = window.innerWidth * options.widthRatio;
  windowHeight = window.innerHeight * options.heightRatio;
  var mediaType = curImg.attr("mtype");
  if (mediaType == "image") {
    tmpImage  = new Image();
    $(tmpImage).on('error', onMediumError);
    tmpImage.onload = onMediumLoad;
    tmpImage.src = curImg.attr("src");
  } else if (mediaType == "audio") {
    onMediumLoad();
  } else if (mediaType == "pdf" || mediaType == "epub") {
    curImg.bind('load', function() { onMediumLoad(); });;
  } else if (mediaType == "video") {
    tmpImage = document.createElement("video");
    $(tmpImage).on('error', onMediumError);
    tmpImage.onloadstart = onMediumLoad;
    tmpImage.src = curImg.attr("src");
  }
  curImg.data('scale',1);
  curImg.data('translate-x',0);
  curImg.data('translate-y',0);
  zoomPanElement(0, 0, 1);
};


var onMediumError = function(ev) {
  //no image was found
  objects.eq(index).trigger($.Event('error.simplelightbox'));
  animating = false;
  opened = true;
  spinner.hide();
  var dirDefinined = (dir == 1 || dir == -1);
  if (startIndex === index && dirDefinined) { close(); return; }
  if(options.alertError) { alert(options.alertErrorMessage); }
  if (dirDefinined) { loadImage(dir); } else { loadImage(1); }
  return;
};


var onMediumLoad = function() {
  if (typeof dir !== 'undefined') {
    objects.eq(index)
      .trigger($.Event('changed.simplelightbox'))
      .trigger($.Event((dir===1?'nextDone':'prevDone')+'.simplelightbox'));
  }
  // history
  if (options.history) { updateURL(); }
  if (loaded.indexOf(curImg.attr("src")) == -1) { loaded.push(curImg.attr("src")); }
  var mediaType = curImg.attr("mtype");
  var imageWidth = window.innerWidth;
  var imageHeight = window.innerHeight;
  if (mediaType == "image") {
    imageWidth = tmpImage.width; imageHeight = tmpImage.height;
  } else if (mediaType == "audio") {
    imageWidth = window.innerWidth; imageHeight = 50;
  } else if (mediaType == "pdf" || mediaType == "epub") {
    imageWidth =  Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    imageHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    $('.sl-image iframe').contents().find('html').css({ height: '100%' });
    $('.sl-image iframe').contents().find('body').css({ height: '100%' });
  } else if (mediaType == "video") {
    var x = tmpImage.videoWidth; var y = tmpImage.videoHeight;
    if (!x) { x = window.innerWidth; y = window.innerHeight; }
    imageWidth = x*(options.widthRatio-0.25); imageHeight = y*(options.heightRatio-0.25)+300;
  }
  if (options.scaleImageToRatio || imageWidth > windowWidth || imageHeight > windowHeight ) {
    var ratio  = imageWidth / imageHeight > windowWidth / windowHeight ? imageWidth / windowWidth : imageHeight / windowHeight;
    imageWidth  /= ratio;
    imageHeight /= ratio;
  }
  $(".sl-image").css({
    'top':    (window.innerHeight - imageHeight ) / 2 - 25 + 'px',
    'left':   (window.innerWidth - imageWidth - globalScrollbarwidth)/ 2 + 'px',
    'width':  imageWidth + 'px',
    'height': imageHeight + 'px'
  });
  spinner.hide();
  curImg.fadeIn('fast');
  opened = true;
  var cSel = (options.captionSelector == 'self') ? objects.eq(index) : objects.eq(index).find(options.captionSelector);
  var captionText;
  if(options.captionType == 'data'){
    captionText = cSel.data(options.captionsData);
  } else if(options.captionType == 'text'){
    captionText = cSel.html();
  } else {
    captionText = cSel.prop(options.captionsData);
  }
  if(!options.loop) {
    if(index === 0){ $('.sl-prev').hide();}
    if(index >= objects.length -1) {$('.sl-next').hide();}
    if(index > 0){ $('.sl-prev').show(); }
    if(index < objects.length -1){ $('.sl-next').show(); }
  }
  if(objects.length == 1) $('.sl-prev, .sl-next').hide();
  if(dir == 1 || dir == -1) {
    var css = { 'opacity': 1.0 };
    if( options.animationSlide ) {
      if( canTransisions ) {
        slide(0, 100 * dir + 'px');
        setTimeout( function(){ slide( options.animationSpeed / 1000, 0 + 'px'); }, 50 );
      } else {
        css.left = parseInt( $('.sl-image').css( 'left' ) ) + 100 * dir + 'px';
      }
    }
    $('.sl-image').animate( css, options.animationSpeed, function(){
      animating = false;
      setCaption(captionText, imageWidth);
    });
  } else {
    animating = false;
    setCaption(captionText, imageWidth);
  }
  if(options.additionalHtml && $('.sl-additional-html').length === 0){
    $('<div>').html(options.additionalHtml).addClass('sl-additional-html').appendTo($('.sl-image'));
  }
};


var setCaption = function(captiontext, imageWidth) {
  if (captiontext !== '' && typeof captiontext !== "undefined" && options.captions) {
    caption.html(captiontext)
      .css({'width': imageWidth + 'px'})
      .hide()
      .appendTo($('.sl-image'))
      .delay(options.captionDelay)
      .fadeIn('fast');
  }
};


var slide = function(speed, pos) {
  var styles = {};
  styles[transPrefix + 'transform'] = 'translateX(' + pos + ')';
  styles[transPrefix + 'transition'] = transPrefix + 'transform ' + speed + 's linear';
  $('.sl-image').css(styles);
};


var  zoomPanElement = function(targetOffsetX, targetOffsetY, targetScale) {
  var styles = {};
  styles[transPrefix + 'transform'] = 'translate(' + targetOffsetX + ',' + targetOffsetY+ ') scale('+targetScale+')';
  curImg.css(styles);
};


var minMax = function(value, min, max) {
  return (value < min) ? min : (value > max) ? max : value;
};


var setZoomData = function(initialScale,targetOffsetX,targetOffsetY) {
  curImg.data('scale', initialScale);
  curImg.data('translate-x', targetOffsetX);
  curImg.data('translate-y', targetOffsetY);
};


var addEvents = function() {
  // resize/responsive
  $(window).on('resize.'+prefix, adjustImage);
  // close lightbox on close btn
  $('.sl-wrapper').on('click.'+prefix+ ' touchstart.'+prefix, '.sl-close', function(e) {
    e.preventDefault(); if(opened) { close(); history.go(-1); }
  });
  if (options.history) {
    setTimeout(function() {
      $(window).on('hashchange.'+prefix,function() {
        if(opened) { if(getHash() === initialHash) { close(); return; } }
      });
    }, 40);
  }
  // nav-buttons
  nav.on('click.'+prefix, 'button', throttle(function(e) {
    e.preventDefault();
    swipeDiff = 0;
    loadImage($(this).hasClass('sl-next') ? 1 : -1);
  }, options.throttleInterval));
  // touch helpers
  var swipeStart   = 0;
  var swipeEnd   = 0;
  var swipeYStart = 0;
  var swipeYEnd = 0;
  var zoomed = false;
  var mousedown = false;
  var imageLeft = 0;
  var containerHeight;
  var containerWidth;
  var containerOffsetX;
  var containerOffsetY;
  var imgHeight;
  var imgWidth;
  var capture = false;
  var initialOffsetX;
  var initialOffsetY;
  var initialPointerOffsetX;
  var initialPointerOffsetY;
  var initialPointerOffsetX2;
  var initialPointerOffsetY2;
  var initialScale = minMax(1, 1, options.maxZoom);
  var initialPinchDistance;
  var pointerOffsetX;
  var pointerOffsetY;
  var pointerOffsetX2;
  var pointerOffsetY2;
  var targetOffsetX;
  var targetOffsetY;
  var targetScale;
  var pinchOffsetX;
  var pinchOffsetY;
  var limitOffsetX;
  var limitOffsetY;
  var scaleDifference;
  var targetPinchDistance;
  var touchCount;
  var doubleTapped = false;
  var touchmoveCount = 0;
  image.on( 'touchstart.'+prefix+' mousedown.'+prefix, function(e)  {
    if (e.target.tagName === 'A' && e.type == 'touchstart') { return true; }
    e = e.originalEvent;
    if (e.type == 'mousedown') {
      initialPointerOffsetX = e.clientX;
      initialPointerOffsetY = e.clientY;
      containerHeight = image.height();
      containerWidth = image.width();
      imgHeight = curImg.height();
      imgWidth = curImg.width();
      containerOffsetX = image.position().left;
      containerOffsetY = image.position().top;
      initialOffsetX = parseFloat(curImg.data('translate-x'));
      initialOffsetY = parseFloat(curImg.data('translate-y'));
      capture = true;
    } else {
      touchCount = e.touches.length;
      initialPointerOffsetX = e.touches[0].clientX;
      initialPointerOffsetY = e.touches[0].clientY;
      containerHeight = image.height();
      containerWidth = image.width();
      imgHeight = curImg.height();
      imgWidth = curImg.width();
      containerOffsetX = image.position().left;
      containerOffsetY = image.position().top;
      if (touchCount === 1) /* Single touch */ {
        if (!doubleTapped) {
          doubleTapped = true;
          setTimeout(function() { doubleTapped = false; }, 300);
        } else {
          curImg.addClass('sl-transition');
          if (!zoomed) {
            initialScale = options.doubleTapZoom;
            setZoomData(0,0, initialScale);
            zoomPanElement(0 + "px", 0 + "px", initialScale);
            $('.sl-caption').fadeOut(200);
            zoomed = true;
          } else {
            initialScale = 1;
            setZoomData(0,0,initialScale);
            zoomPanElement(0 + "px", 0 + "px", initialScale);
            zoomed = false;
          }
          setTimeout(function() { curImg.removeClass('sl-transition'); }, 200);
          return false;
        }
        initialOffsetX = parseFloat(curImg.data('translate-x'));
        initialOffsetY = parseFloat(curImg.data('translate-y'));
      } else if (touchCount === 2) /* Pinch */ {
        initialPointerOffsetX2 = e.touches[1].clientX;
        initialPointerOffsetY2 = e.touches[1].clientY;
        initialOffsetX = parseFloat(curImg.data('translate-x'));
        initialOffsetY = parseFloat(curImg.data('translate-y'));
        pinchOffsetX = (initialPointerOffsetX + initialPointerOffsetX2) / 2;
        pinchOffsetY = (initialPointerOffsetY + initialPointerOffsetY2) / 2;
        initialPinchDistance = Math.sqrt(((initialPointerOffsetX - initialPointerOffsetX2) * (initialPointerOffsetX - initialPointerOffsetX2)) + ((initialPointerOffsetY - initialPointerOffsetY2) * (initialPointerOffsetY - initialPointerOffsetY2)));
      }
      capture = true;
    }
    if (mousedown) { return true; }
    if (canTransisions) { imageLeft = parseInt(image.css( 'left' )); }
    mousedown = true;
    swipeDiff = 0;
    swipeYDiff = 0;
    swipeStart = e.pageX || e.touches[ 0 ].pageX;
    swipeYStart = e.pageY || e.touches[ 0 ].pageY;
    return false;
  });
  image.on('touchmove.'+prefix+' mousemove.'+prefix+' MSPointerMove', function(e) {
    if(!mousedown) { return true; }
    e.preventDefault();
    e = e.originalEvent;
    /* Initialize helpers */
    if (e.type == 'touchmove') {
      if (capture === false) { return false; }
      pointerOffsetX = e.touches[0].clientX;
      pointerOffsetY = e.touches[0].clientY;
      touchCount = e.touches.length;
      touchmoveCount++;
      if (touchCount > 1) /* Pinch */ {
        pointerOffsetX2 = e.touches[1].clientX;
        pointerOffsetY2 = e.touches[1].clientY;
        targetPinchDistance = Math.sqrt(((pointerOffsetX - pointerOffsetX2) * (pointerOffsetX - pointerOffsetX2)) + ((pointerOffsetY - pointerOffsetY2) * (pointerOffsetY - pointerOffsetY2)));
        if (initialPinchDistance === null) { initialPinchDistance = targetPinchDistance; }
        if (Math.abs(initialPinchDistance - targetPinchDistance) >= 1) { /* Initialize helpers */
          targetScale = minMax(targetPinchDistance / initialPinchDistance * initialScale, 1, options.maxZoom);
          limitOffsetX = ((imgWidth * targetScale) - containerWidth) / 2;
          limitOffsetY = ((imgHeight * targetScale) - containerHeight) / 2;
          scaleDifference = targetScale - initialScale;
          targetOffsetX = (imgWidth * targetScale) <= containerWidth ? 0: minMax(initialOffsetX - ((((((pinchOffsetX - containerOffsetX) - (containerWidth / 2)) - initialOffsetX) / (targetScale - scaleDifference))) * scaleDifference), limitOffsetX * (-1), limitOffsetX);
          targetOffsetY = (imgHeight * targetScale) <= containerHeight ? 0 : minMax(initialOffsetY - ((((((pinchOffsetY - containerOffsetY) - (containerHeight / 2)) - initialOffsetY) / (targetScale - scaleDifference))) * scaleDifference), limitOffsetY * (-1), limitOffsetY);
          zoomPanElement(targetOffsetX + "px", targetOffsetY + "px", targetScale);
          if (targetScale > 1) { zoomed = true; $('.sl-caption').fadeOut(200); }
          initialPinchDistance = targetPinchDistance;
          initialScale = targetScale;
          initialOffsetX = targetOffsetX;
          initialOffsetY = targetOffsetY;
        }
      } else {
        targetScale = initialScale;
        limitOffsetX = ((imgWidth * targetScale) - containerWidth) / 2;
        limitOffsetY = ((imgHeight * targetScale) - containerHeight) / 2;
        targetOffsetX = (imgWidth * targetScale) <= containerWidth ? 0 : minMax(pointerOffsetX - (initialPointerOffsetX - initialOffsetX), limitOffsetX * (-1), limitOffsetX);
        targetOffsetY = (imgHeight * targetScale) <= containerHeight ? 0 : minMax(pointerOffsetY - (initialPointerOffsetY - initialOffsetY), limitOffsetY * (-1), limitOffsetY);
        if (Math.abs(targetOffsetX) === Math.abs(limitOffsetX)) {
          initialOffsetX = targetOffsetX; initialPointerOffsetX = pointerOffsetX;
        }
        if (Math.abs(targetOffsetY) === Math.abs(limitOffsetY)) {
          initialOffsetY = targetOffsetY; initialPointerOffsetY = pointerOffsetY;
        }
        setZoomData(initialScale,targetOffsetX,targetOffsetY);
        zoomPanElement(targetOffsetX + "px", targetOffsetY + "px", targetScale);
      }
    }
    /* Mouse Move implementation */
    if (e.type == 'mousemove' && mousedown) {
      if (e.type == 'touchmove') { return true; }
      if (capture === false) { return false; }
      pointerOffsetX = e.clientX;
      pointerOffsetY = e.clientY;
      targetScale = initialScale;
      limitOffsetX = ((imgWidth * targetScale) - containerWidth) / 2;
      limitOffsetY = ((imgHeight * targetScale) - containerHeight) / 2;
      targetOffsetX = (imgWidth * targetScale) <= containerWidth ? 0 : minMax(pointerOffsetX - (initialPointerOffsetX - initialOffsetX), limitOffsetX * (-1), limitOffsetX);
      targetOffsetY = (imgHeight * targetScale) <= containerHeight ? 0 : minMax(pointerOffsetY - (initialPointerOffsetY - initialOffsetY), limitOffsetY * (-1), limitOffsetY);
      if (Math.abs(targetOffsetX) === Math.abs(limitOffsetX)) {
        initialOffsetX = targetOffsetX; initialPointerOffsetX = pointerOffsetX;
      }
      if (Math.abs(targetOffsetY) === Math.abs(limitOffsetY)) {
        initialOffsetY = targetOffsetY; initialPointerOffsetY = pointerOffsetY;
      }
      setZoomData(initialScale,targetOffsetX,targetOffsetY);
      zoomPanElement(targetOffsetX + "px", targetOffsetY + "px", targetScale);
    }
    if (!zoomed) {
      swipeEnd = e.pageX || e.touches[0].pageX;
      swipeYEnd = e.pageY || e.touches[0].pageY;
      swipeDiff = swipeStart - swipeEnd;
      swipeYDiff = swipeYStart - swipeYEnd;
      if (options.animationSlide) {
        if (canTransisions) { slide(0, -swipeDiff + 'px' ); } else { image.css( 'left', imageLeft - swipeDiff + 'px' ); }
      }
    }
  });
  image.on('touchend.'+prefix+' mouseup.'+prefix+' touchcancel.'+prefix+' mouseleave.'+prefix+' pointerup pointercancel MSPointerUp MSPointerCancel', function(e) {
    e = e.originalEvent;
    if (touchDevice && e.type =='touchend') {
      touchCount = e.touches.length;
      if (touchCount === 0) /* No touch */ {
        setZoomData(initialScale,targetOffsetX,targetOffsetY); /* Set attributes */
        if (initialScale == 1) { zoomed = false; $('.sl-caption').fadeIn(200); }
        initialPinchDistance = null; capture = false;
      } else if (touchCount === 1) /* Single touch */ {
        initialPointerOffsetX = e.touches[0].clientX;
        initialPointerOffsetY = e.touches[0].clientY;
      } else if (touchCount > 1) /* Pinch */ {
        initialPinchDistance = null;
      }
    }
    if (mousedown) {
      mousedown = false;
      var possibleDir = true;
      if (!options.loop) {
        if (index === 0 && swipeDiff < 0) { possibleDir = false; }
        if (index >= objects.length -1 && swipeDiff > 0) { possibleDir = false; }
      }
      if (Math.abs(swipeDiff) > options.swipeTolerance && possibleDir) {
        loadImage(swipeDiff > 0 ? 1 : -1);
      } else if (options.animationSlide) {
        if (canTransisions) {
          slide( options.animationSpeed / 1000, 0 + 'px' );
        } else {
          image.animate({ 'left': imageLeft + 'px' }, options.animationSpeed / 2 );
        }
      }
      if (options.swipeClose && Math.abs(swipeYDiff) > 50 && Math.abs(swipeDiff) < options.swipeTolerance) {
        close();
      }
    }
  });
  /** Detect Double click on image*/
  image.on('dblclick', function(e) {
    initialPointerOffsetX = e.clientX;
    initialPointerOffsetY = e.clientY;
    containerHeight = image.height();
    containerWidth = image.width();
    imgHeight = curImg.height();
    imgWidth = curImg.width();
    containerOffsetX = image.position().left;
    containerOffsetY = image.position().top;
    curImg.addClass('sl-transition');
    if (!zoomed) {
      initialScale = options.doubleTapZoom;
      setZoomData(0,0, initialScale);
      zoomPanElement(0 + "px", 0 + "px", initialScale);
      $('.sl-caption').fadeOut(200);
      zoomed = true;
    } else {
      initialScale = 1;
      setZoomData(0,0,initialScale);
      zoomPanElement(0 + "px", 0 + "px", initialScale);
      zoomed = false;
      $('.sl-caption').fadeIn(200);
    }
    setTimeout(function() { curImg.removeClass('sl-transition'); }, 200);
    capture = true;
    return false;
  });
};


var removeEvents = function() {
  nav.off('click', 'button');
  $( '.sl-wrapper' ).off('click.'+prefix, '.sl-close');
  $( window ).off( 'resize.'+prefix);
  $( window ).off( 'hashchange.'+prefix);
};


var preload = function() {
  var next = (index+1 < 0) ? objects.length -1: (index+1 >= objects.length -1) ? 0 : index+1;
  var prev = (index-1 < 0) ? objects.length -1: (index-1 >= objects.length -1) ? 0 : index-1;
  $( '<img />' ).attr( 'src', objects.eq(next).attr( options.sourceAttr ) ).on('load', function() {
    if(loaded.indexOf($(this).attr('src')) == -1) { loaded.push($(this).attr('src')); }
    objects.eq(index).trigger($.Event('nextImageLoaded.simplelightbox'));
  });
  $('<img />').attr('src', objects.eq(prev).attr( options.sourceAttr ) ).on('load', function() {
    if (loaded.indexOf($(this).attr('src')) == -1) { loaded.push($(this).attr('src')); }
    objects.eq(index).trigger($.Event('prevImageLoaded.simplelightbox'));
  });
};


var loadImage = function(direction) {
  dir = direction;
  objects.eq(index)
    .trigger($.Event('change.simplelightbox'))
    .trigger($.Event((direction===1?'next':'prev')+'.simplelightbox'));
  var newIndex = index + direction;
  if (animating || (newIndex < 0 || newIndex >= objects.length) && options.loop === false ) { return; }
  index = (newIndex < 0) ? objects.length -1: (newIndex > objects.length -1) ? 0 : newIndex;
  $('.sl-wrapper .sl-counter .sl-current').text(index +1);
  var css = { 'opacity': 0 };
  if (options.animationSlide) {
    if (canTransisions) {
      slide(options.animationSpeed / 1000, (-100 * direction) - swipeDiff + 'px');
    } else {
      css.left = parseInt( $('.sl-image').css( 'left' )) + -100 * direction + 'px';
    }
  }
  $('.sl-image').animate( css, options.animationSpeed, function() {
    setTimeout(function() {
      // fadeout old image
      var elem = objects.eq(index);
      if ($(elem).attr("type").endsWith("pub+zip")) {
        curImg.attr('src', "/epub_reader/?epub=" + elem.attr(options.sourceAttr));
      } else {
        curImg.attr('src', elem.attr(options.sourceAttr));
      }
      if (loaded.indexOf(elem.attr(options.sourceAttr)) == -1) { spinner.show(); }
      $('.sl-caption').remove();
      adjustImage(direction);
      if (options.preloading) { preload(); }
    }, 100);
  });
};


var close = function() {
  if (animating) { return; }
  var elem = objects.eq(index);
  var triggered = false;
  elem.trigger($.Event('close.simplelightbox'));
  if (options.history) { resetHash(); }
  $('.sl-image *, .sl-overlay, .sl-close, .sl-navigation, .sl-counter')
    .fadeOut('fast', function() {
      if (options.disableScroll) { handleScrollbar('show'); }
      if (options.htmlClass && options.htmlClass != '') { $('html').removeClass(options.htmlClass); }
      $('.sl-wrapper, .sl-overlay').remove();
      removeEvents();
      if (!triggered) elem.trigger($.Event('closed.simplelightbox'));
      triggered = true;
    });
  curImg = $();
  opened = false;
  animating = false;
};


var handleScrollbar = function(type) {
  var scrollbarWidth = 0;
  if (type == 'hide') {
    var fullWindowWidth = window.innerWidth;
    if (!fullWindowWidth) {
      var documentElementRect = document.documentElement.getBoundingClientRect();
      fullWindowWidth = documentElementRect.right - Math.abs(documentElementRect.left);
    }
    if (document.body.clientWidth < fullWindowWidth) {
      var scrollDiv = document.createElement('div'),
      padding = parseInt($('body').css('padding-right'), 10);
      scrollDiv.className = 'sl-scrollbar-measure';
      $('body').append(scrollDiv);
      scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
      $(document.body)[0].removeChild(scrollDiv);
      $('body').data('padding',padding);
      if (scrollbarWidth > 0) {
        $('body').addClass('hidden-scroll').css({'padding-right':padding+scrollbarWidth});
      }
    }
  } else {
    $('body').removeClass('hidden-scroll').css({'padding-right':$('body').data('padding')});
  }
  return scrollbarWidth;
};


// events
setup();


// open lightbox
objects.on('click.'+prefix, function(e) {
  e.preventDefault();
  if (isValidLink(this)) {
    if (animating) return false;
    var elem = $(this);
    startIndex = objects.index(elem);
    openImage(elem);
  }
});


// close on click on doc
$(document).on('click.'+prefix+ ' touchstart.'+prefix, function(e) {
  if (opened) {
    if ((options.docClose && $(e.target).closest('.sl-image').length === 0 &&
        $(e.target).closest('.sl-navigation').length === 0)) { close(); }
  }
});


// disable rightclick
if(options.disableRightClick){
  $( document ).on('contextmenu', '.sl-image img', function(e){
    return false;
  });
}


// keyboard-control
if (options.enableKeyboard) {
$(document).on('keyup.'+prefix, throttle(function( e ) {
  swipeDiff = 0;
  // keyboard control only if lightbox is open
  var key = e.keyCode;
  if (animating && key == 27) {
    curImg.attr('src', '');
    animating = false;
    close();
  }
  if (opened) {
    e.preventDefault();
    if (key == 27) { close(); history.go(-1);  }
    if (key == 37 || e.keyCode == 39 ) {  loadImage(e.keyCode == 39 ? 1 : -1); }
  }
}, options.throttleInterval));
};


// Public methods
this.open = function(elem) { elem = elem || $(this[0]); startIndex = objects.index(elem); openImage(elem); };
this.next = function() { loadImage(1); };
this.prev = function() { loadImage(-1); };
this.close = function() { close(); };
this.destroy = function() {
  $( document ).off('click.'+prefix).off('keyup.'+prefix); close();
  $('.sl-overlay, .sl-wrapper').remove(); this.off('click');
};
this.refresh = function() { this.destroy(); $(this).simpleLightbox(options); };


return this;
};}) (jQuery, window, document);
