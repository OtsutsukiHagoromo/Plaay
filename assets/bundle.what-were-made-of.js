/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["what-were-made-of"],{

/***/ "./src/js/modules/what-were-made-of.js":
/*!*********************************************!*\
  !*** ./src/js/modules/what-were-made-of.js ***!
  \*********************************************/
/***/ (() => {

eval("class WhatWereMadeOf extends HTMLElement {\r\n  constructor(){\r\n    super();\r\n\r\n    this.togglePointsDescription();\r\n    this.initialiseMobileSlider();\r\n  }\r\n\r\n  initialiseMobileSlider () {\r\n    setTimeout(() => {\r\n      if (window.matchMedia('(max-width: 1280px)').matches) {\r\n        const mobileSlider = new Glide(this.querySelector('.points_container'), {\r\n          type: 'carousel',\r\n          autoplay: 2500,\r\n          perView: 3.5,\r\n          breakpoints: {\r\n            1024: {\r\n              perView: 3\r\n            },\r\n            768: {\r\n              perView: 2.5\r\n            },\r\n            600: {\r\n              perView: 2\r\n            },\r\n            480: {\r\n              perView: 1.5\r\n            },\r\n            375: {\r\n              perView: 1\r\n            }\r\n          }\r\n        });\r\n        mobileSlider.mount();\r\n      }\r\n    }, 500);\r\n  }\r\n\r\n  togglePointsDescription () {\r\n\r\n    const informationIcon = document.querySelectorAll('.information_icon');\r\n    informationIcon.forEach(icon => {\r\n      const close = icon.closest('.point').querySelector('.close_point');\r\n      const pointContainer = icon.closest('.point');\r\n      close.addEventListener('click', () => {\r\n        pointContainer.classList.remove('active');\r\n        close.classList.add('opacity-0');\r\n      });\r\n      icon.addEventListener('click', () => {\r\n        pointContainer.classList.add('active');\r\n        close.classList.remove('opacity-0');\r\n      });\r\n    });\r\n  }\r\n}\r\ncustomElements.define('what-were-made-of', WhatWereMadeOf);\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/what-were-made-of.js?");

/***/ })

}]);