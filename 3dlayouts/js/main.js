/**
 * main.js
 * http://www.aeeg.com
 *
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 * 
 * Copyright 2016, aeeg
 * http://www.aeeg.com
 */
;(function(window) {

	'use strict';

	// helper functions
	// from https://davidwalsh.name/vendor-prefix
	var prefix = (function () {
		var styles = window.getComputedStyle(document.documentElement, ''),
			pre = (Array.prototype.slice.call(styles).join('').match(/-(moz|webkit|ms)-/) || (styles.OLink === '' && ['', 'o']))[1],
			dom = ('WebKit|Moz|MS|O').match(new RegExp('(' + pre + ')', 'i'))[1];
		
		return {
			dom: dom,
			lowercase: pre,
			css: '-' + pre + '-',
			js: pre[0].toUpperCase() + pre.substr(1)
		};
	})();
	
	// vars & stuff
	var support = {transitions : Modernizr.csstransitions},
		transEndEventNames = {'WebkitTransition': 'webkitTransitionEnd', 'MozTransition': 'transitionend', 'OTransition': 'oTransitionEnd', 'msTransition': 'MSTransitionEnd', 'transition': 'transitionend'},
		transEndEventName = transEndEventNames[Modernizr.prefixed('transition')],
		onEndTransition = function(el, callback, propTest) {
			var onEndCallbackFn = function( ev ) {
				if( support.transitions ) {
					if( ev.target != this || propTest && ev.propertyName !== propTest && ev.propertyName !== prefix.css + propTest ) return;
					this.removeEventListener( transEndEventName, onEndCallbackFn );
				}
				if( callback && typeof callback === 'function' ) { callback.call(this); }
			};
			if( support.transitions ) {
				el.addEventListener( transEndEventName, onEndCallbackFn );
			}
			else {
				onEndCallbackFn();
			}
		},
		// the centre element
		centre = document.querySelector('.centre'),
		// centre´s layouts wrapper
		centrelayoutsEl = centre.querySelector('.layouts'),
		// centre´s layouts
		centrelayouts = [].slice.call(centrelayoutsEl.querySelectorAll('.layout')),
		// total layouts
		centrelayoutsTotal = centrelayouts.length,
		// surroundings elems
		centreSurroundings = [].slice.call(centre.querySelectorAll('.surroundings')),
		// selected layout position
		selectedlayout,
		// navigation element wrapper
		centreNav = document.querySelector('.centrenav'),
		// show all centre´s layouts ctrl
		alllayoutsCtrl = centreNav.querySelector('.centrenav__button--all-layouts'),
		// layouts navigation up/down ctrls
		layoutUpCtrl = centreNav.querySelector('.centrenav__button--up'),
		layoutDownCtrl = centreNav.querySelector('.centrenav__button--down'),
		// pins
		pins = [].slice.call(centrelayoutsEl.querySelectorAll('.pin')),
		// content element
		contentEl = document.querySelector('.content'),
		// content close ctrl
		contentCloseCtrl = contentEl.querySelector('button.content__button'),
		// check if a content item is opened
		isOpenContentArea,
		// check if currently animating/navigating
		isNavigating,
		// check if all layouts are shown or if one layout is shown (expanded)
		isExpanded,
		// spaces list element
		spacesListEl = document.getElementById('spaces-list'),
		// spaces list ul
		spacesEl = spacesListEl.querySelector('ul.list'),
		// all the spaces listed
		spaces = [].slice.call(spacesEl.querySelectorAll('.list__item > a.list__link')),
		// reference to the current shows space (name set in the data-name attr of both the listed spaces and the pins on the map)
		spaceref,
		// sort by ctrls
		sortByNameCtrl = document.querySelector('#sort-by-name'),
		// listjs initiliazation (all centre´s spaces)
		spacesList = new List('spaces-list', { valueNames: ['list__link', { data: ['layout'] }, { data: ['category'] } ]} ),

		// scentreer screens:
		// open search ctrl
		openSearchCtrl = document.querySelector('button.open-search'),
		// main container
		containerEl = document.querySelector('.container'),
		// close search ctrl
		closeSearchCtrl = spacesListEl.querySelector('button.close-search');

	function init() {
		// init/bind events
		initEvents();
	}

	/**
	 * Initialize/Bind events fn.
	 */
	function initEvents() {
		// click on a Mall´s layout
		centrelayouts.forEach(function(layout, pos) {
			layout.addEventListener('click', function() {
				// shows this layout
				showlayout(pos+1);
			});
		});

		// click on the show centre´s layouts ctrl
		alllayoutsCtrl.addEventListener('click', function() {
			// shows all layouts
			showAlllayouts();
		});

		// navigating through the layouts
		layoutUpCtrl.addEventListener('click', function() { navigate('Down'); });
		layoutDownCtrl.addEventListener('click', function() { navigate('Up'); });

		// sort by name ctrl - add/remove category name (css pseudo element) from list and sorts the spaces by name 
		sortByNameCtrl.addEventListener('click', function() {
			if( this.checked ) {
				classie.remove(spacesEl, 'grouped-by-category');
				spacesList.sort('list__link');
			}
			else {
				classie.add(spacesEl, 'grouped-by-category'); 
				spacesList.sort('category');
			}
		});

		// hovering a pin / clicking a pin
		pins.forEach(function(pin) {
			var contentItem = contentEl.querySelector('.content__item[data-space="' + pin.getAttribute('data-space') + '"]');

			pin.addEventListener('mouseenter', function() {
				if( !isOpenContentArea ) {
					classie.add(contentItem, 'content__item--hover');
				}
			});
			pin.addEventListener('mouseleave', function() {
				if( !isOpenContentArea ) {
					classie.remove(contentItem, 'content__item--hover');
				}
			});
			pin.addEventListener('click', function(ev) {
				ev.preventDefault();
				// open content for this pin
				openContent(pin.getAttribute('data-space'));
				// remove hover class (showing the title)
				classie.remove(contentItem, 'content__item--hover');
			});
		});

		// closing the content area
		contentCloseCtrl.addEventListener('click', function() {
			closeContentArea();
		});

		// clicking on a listed space: open layout - shows space
		spaces.forEach(function(space) {
			var spaceItem = space.parentNode,
				layout = spaceItem.getAttribute('data-layout'),
				spacerefval = spaceItem.getAttribute('data-space');

			space.addEventListener('click', function(ev) {
				ev.preventDefault();
				// for scentreer screens: close search bar
				closeSearch();
				// open layout
				showlayout(layout);
				// open content for this space
				openContent(spacerefval);
			});
		});

		// scentreer screens: open the search bar
		openSearchCtrl.addEventListener('click', function() {
			openSearch();
		});

		// scentreer screens: close the search bar
		closeSearchCtrl.addEventListener('click', function() {
			closeSearch();
		});
	}

	/**
	 * Opens a layout. The current layout moves to the center while the other ones move away.
	 */
	function showlayout(layout) {
		if( isExpanded ) {
			return false;
		}
		
		// update selected layout val
		selectedlayout = layout;

		// control navigation controls state
		setNavigationState();

		classie.add(centrelayoutsEl, 'layouts--selected-' + selectedlayout);
		
		// the layout element
		var layoutEl = centrelayouts[selectedlayout - 1];
		classie.add(layoutEl, 'layout--current');

		onEndTransition(layoutEl, function() {
			classie.add(centrelayoutsEl, 'layouts--open');

			// show layout pins
			showPins();

			isExpanded = true;
		}, 'transform');
		
		// hide surroundings element
		hideSurroundings();
		
		// show centre nav ctrls
		showMallNav();

		// filter the spaces for this layout
		showlayoutSpaces();
	}

	/**
	 * Shows all Mall´s layouts
	 */
	function showAlllayouts() {
		if( isNavigating || !isExpanded ) {
			return false;
		}
		isExpanded = false;

		classie.remove(centrelayouts[selectedlayout - 1], 'layout--current');
		classie.remove(centrelayoutsEl, 'layouts--selected-' + selectedlayout);
		classie.remove(centrelayoutsEl, 'layouts--open');

		// hide layout pins
		removePins();

		// shows surrounding element
		showSurroundings();
		
		// hide centre nav ctrls
		hideMallNav();

		// show back the complete list of spaces
		spacesList.filter();

		// close content area if it is open
		if( isOpenContentArea ) {
			closeContentArea();
		}
	}

	/**
	 * Shows all spaces for current layout
	 */
	function showlayoutSpaces() {
		spacesList.filter(function(item) { 
			return item.values().layout === selectedlayout.toString(); 
		});
	}

	/**
	 * Shows the layout´s pins
	 */
	function showPins(layoutEl) {
		var layoutEl = layoutEl || centrelayouts[selectedlayout - 1];
		classie.add(layoutEl.querySelector('.layout__pins'), 'layout__pins--active');
	}

	/**
	 * Removes the layout´s pins
	 */
	function removePins(layoutEl) {
		var layoutEl = layoutEl || centrelayouts[selectedlayout - 1];
		classie.remove(layoutEl.querySelector('.layout__pins'), 'layout__pins--active');
	}

	/**
	 * Show the navigation ctrls
	 */
	function showMallNav() {
		classie.remove(centreNav, 'centrenav--hidden');
	}

	/**
	 * Hide the navigation ctrls
	 */
	function hideMallNav() {
		classie.add(centreNav, 'centrenav--hidden');
	}

	/**
	 * Show the surroundings layout
	 */
	function showSurroundings() {
		centreSurroundings.forEach(function(el) {
			classie.remove(el, 'surroundings--hidden');
		});
	}

	/**
	 * Hide the surroundings layout
	 */
	function hideSurroundings() {
		centreSurroundings.forEach(function(el) {
			classie.add(el, 'surroundings--hidden');
		});
	}

	/**
	 * Navigate through the centre´s layouts
	 */
	function navigate(direction) {
		if( isNavigating || !isExpanded || isOpenContentArea ) {
			return false;
		}
		isNavigating = true;

		var prevSelectedlayout = selectedlayout;

		// current layout
		var currentlayout = centrelayouts[prevSelectedlayout-1];

		if( direction === 'Up' && prevSelectedlayout > 1 ) {
			--selectedlayout;
		}
		else if( direction === 'Down' && prevSelectedlayout < centrelayoutsTotal ) {
			++selectedlayout;
		}
		else {
			isNavigating = false;	
			return false;
		}

		// control navigation controls state (enabled/disabled)
		setNavigationState();
		// transition direction class
		classie.add(currentlayout, 'layout--moveOut' + direction);
		// next layout element
		var nextlayout = centrelayouts[selectedlayout-1]
		// ..becomes the current one
		classie.add(nextlayout, 'layout--current');

		// when the transition ends..
		onEndTransition(currentlayout, function() {
			classie.remove(currentlayout, 'layout--moveOut' + direction);
			// solves rendering bug for the SVG opacity-fill property
			setTimeout(function() {classie.remove(currentlayout, 'layout--current');}, 60);

			classie.remove(centrelayoutsEl, 'layouts--selected-' + prevSelectedlayout);
			classie.add(centrelayoutsEl, 'layouts--selected-' + selectedlayout);

			// show the current layout´s pins
			showPins();

			isNavigating = false;
		});

		// filter the spaces for this layout
		showlayoutSpaces();

		// hide the previous layout´s pins
		removePins(currentlayout);
	}

	/**
	 * Control navigation ctrls state. Add disable class to the respective ctrl when the current layout is either the first or the last.
	 */
	function setNavigationState() {
		if( selectedlayout == 1 ) {
			classie.add(layoutDownCtrl, 'boxbutton--disabled');
		}
		else {
			classie.remove(layoutDownCtrl, 'boxbutton--disabled');
		}

		if( selectedlayout == centrelayoutsTotal ) {
			classie.add(layoutUpCtrl, 'boxbutton--disabled');
		}
		else {
			classie.remove(layoutUpCtrl, 'boxbutton--disabled');
		}
	}

	/**
	 * Opens/Reveals a content item.
	 */
	function openContent(spacerefval) {
		// if one already shown:
		if( isOpenContentArea ) {
			hideSpace();
			spaceref = spacerefval;
			showSpace();
		}
		else {
			spaceref = spacerefval;
			openContentArea();
		}
		
		// remove class active (if any) from current list item
		var activeItem = spacesEl.querySelector('li.list__item--active');
		if( activeItem ) {
			classie.remove(activeItem, 'list__item--active');
		}
		// list item gets class active
		classie.add(spacesEl.querySelector('li[data-space="' + spacerefval + '"]'), 'list__item--active');

		// remove class selected (if any) from current space
		var activeSpaceArea = centrelayouts[selectedlayout - 1].querySelector('svg > .map__space--selected');
		if( activeSpaceArea ) {
			classie.remove(activeSpaceArea, 'map__space--selected');
		}
		// svg area gets selected
		classie.add(centrelayouts[selectedlayout - 1].querySelector('svg > .map__space[data-space="' + spaceref + '"]'), 'map__space--selected');
	}

	/**
	 * Opens the content area.
	 */
	function openContentArea() {
		isOpenContentArea = true;
		// shows space
		showSpace(true);
		// show close ctrl
		classie.remove(contentCloseCtrl, 'content__button--hidden');
		// resize centre area
		classie.add(centre, 'centre--content-open');
		// disable centre nav ctrls
		classie.add(layoutDownCtrl, 'boxbutton--disabled');
		classie.add(layoutUpCtrl, 'boxbutton--disabled');
	}

	/**
	 * Shows a space.
	 */
	function showSpace(sliding) {
		// the content item
		var contentItem = contentEl.querySelector('.content__item[data-space="' + spaceref + '"]');
		// show content
		classie.add(contentItem, 'content__item--current');
		if( sliding ) {
			onEndTransition(contentItem, function() {
				classie.add(contentEl, 'content--open');
			});
		}
		// map pin gets selected
		classie.add(centrelayoutsEl.querySelector('.pin[data-space="' + spaceref + '"]'), 'pin--active');
	}

	/**
	 * Closes the content area.
	 */
	function closeContentArea() {
		classie.remove(contentEl, 'content--open');
		// close current space
		hideSpace();
		// hide close ctrl
		classie.add(contentCloseCtrl, 'content__button--hidden');
		// resize centre area
		classie.remove(centre, 'centre--content-open');
		// enable centre nav ctrls
		if( isExpanded ) {
			setNavigationState();
		}
		isOpenContentArea = false;
	}

	/**
	 * Hides a space.
	 */
	function hideSpace() {
		// the content item
		var contentItem = contentEl.querySelector('.content__item[data-space="' + spaceref + '"]');
		// hide content
		classie.remove(contentItem, 'content__item--current');
		// map pin gets unselected
		classie.remove(centrelayoutsEl.querySelector('.pin[data-space="' + spaceref + '"]'), 'pin--active');
		// remove class active (if any) from current list item
		var activeItem = spacesEl.querySelector('li.list__item--active');
		if( activeItem ) {
			classie.remove(activeItem, 'list__item--active');
		}
		// remove class selected (if any) from current space
		var activeSpaceArea = centrelayouts[selectedlayout - 1].querySelector('svg > .map__space--selected');
		if( activeSpaceArea ) {
			classie.remove(activeSpaceArea, 'map__space--selected');
		}
	}

	/**
	 * for scentreer screens: open search bar
	 */
	function openSearch() {
		// shows all layouts - we want to show all the spaces for scentreer screens 
		showAlllayouts();

		classie.add(spacesListEl, 'spaces-list--open');
		classie.add(containerEl, 'container--overflow');
	}

	/**
	 * for scentreer screens: close search bar
	 */
	function closeSearch() {
		classie.remove(spacesListEl, 'spaces-list--open');
		classie.remove(containerEl, 'container--overflow');
	}
	
	init();

})(window);