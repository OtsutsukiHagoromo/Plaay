/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["terms-template"],{

/***/ "./src/js/modules/terms-template.js":
/*!******************************************!*\
  !*** ./src/js/modules/terms-template.js ***!
  \******************************************/
/***/ (() => {

eval("class TermsTemplate extends HTMLElement {\r\n  constructor(){\r\n    super();\r\n    \r\n   this.elements = {\r\n    sections: document.querySelectorAll('.terms_section'),\r\n    categories: document.querySelectorAll('[data-desktop-category]')\r\n   };\r\n   this.elements.categories.forEach(category => {\r\n    category.addEventListener('click', this.onCategoryClick.bind(this));\r\n   });\r\n  }\r\n\r\n  toggleSection(category) {\r\n    this.elements.sections.forEach(section => {\r\n      section.classList.remove('max-h-[60rem]');\r\n\r\n      if(section.dataset.category === category){\r\n        section.querySelector('.inner_container').classList.add('max-h-[60rem]');\r\n        section.querySelector('.inner_container').classList.remove('max-h-0');\r\n      } else {\r\n        section.querySelector('.inner_container').classList.remove('max-h-[60rem]');\r\n        section.querySelector('.inner_container').classList.add('max-h-0');\r\n      };\r\n    });\r\n  }\r\n\r\n  onCategoryClick(e) {\r\n    const category = e.target.closest('[data-desktop-category]');\r\n    this.elements.categories.forEach(category => category.classList.remove('active'));\r\n    category.classList.add('active');\r\n    this.toggleSection(category.dataset.title);\r\n  };\r\n}\r\ncustomElements.define('terms-template', TermsTemplate);\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/terms-template.js?");

/***/ })

}]);