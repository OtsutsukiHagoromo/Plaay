/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["product-recommendations"],{

/***/ "./src/js/modules/product-recommendations.js":
/*!***************************************************!*\
  !*** ./src/js/modules/product-recommendations.js ***!
  \***************************************************/
/***/ (() => {

eval("class ProductRecommendations extends HTMLElement {\r\n  constructor(){\r\n    super();\r\n    const loadProductRecommendationsIntoSection = function() {\r\n\r\n      // Look for an element with class 'product-recommendations'\r\n      const productRecommendationsSection = document.querySelector('.product-recommendations');\r\n      if (productRecommendationsSection === null) {\r\n        return;\r\n      }\r\n\r\n      // Read product id from data attribute \r\n      const productId = productRecommendationsSection.dataset.productId;\r\n\r\n      // Read limit from data attribute\r\n      const limit = productRecommendationsSection.dataset.limit;\r\n\r\n      // Build request URL\r\n      const requestUrl = '/recommendations/products?section_id=product-recommendations&limit=' + limit + '&product_id=' + productId;\r\n\r\n      // Create request and submit it using Ajax\r\n      const request = new XMLHttpRequest();\r\n      request.open('GET', requestUrl);\r\n      request.onload = function() {\r\n        if (request.status >= 200 && request.status < 300) {\r\n          const container = document.createElement('div');\r\n          container.innerHTML = request.response;\r\n          if(productRecommendationsSection.parentElement !== undefined && productRecommendationsSection !== null) {\r\n            productRecommendationsSection.parentElement.innerHTML = container.querySelector('.product-recommendations').innerHTML;\r\n          }\r\n        }\r\n      };\r\n      request.send();\r\n    };\r\n\r\n    // If your section has theme settings, the theme editor\r\n    // reloads the section as you edit those settings. When that happens, the\r\n    // recommendations need to be fetched again.\r\n    // See https://help.shopify.com/en/themes/development/sections/integration-with-theme-editor\r\n    document.addEventListener('shopify:section:load', function(event) {\r\n      if (event.detail.sectionId === 'product-recommendations') {\r\n        loadProductRecommendationsIntoSection(); \r\n      }\r\n    });\r\n\r\n    // Fetching the recommendations on page load\r\n    loadProductRecommendationsIntoSection();\r\n  }\r\n}\r\ncustomElements.define('product-recommendations', ProductRecommendations);\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/product-recommendations.js?");

/***/ })

}]);