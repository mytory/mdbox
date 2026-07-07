(function (global) {
    "use strict";

    const VERSION = "1.4.0";

    const DEFAULT_OPTIONS = {
        root: null,
        lang: null,
        defaultLang: "en",
        attributePrefix: "data-mi18n",
        blockAttribute: "data-mi18n-block",
        cloakAttribute: "data-mi18n-cloak",
        attributeSeparator: "-attr-",
        hashPrefix: "mi18n-",
        queryParameter: "mi18n_locale",
        setDocumentLang: true,
        allowHtml: true,
        allowedTags: ["strong", "em", "i", "a", "b", "span", "div", "p", "br", "button"],
        autoApply: false,
    };

    const runtime = {
        options: null,
        currentLang: "",
    };

    function normalizeLanguage(lang) {
        if (!lang || typeof lang !== "string") return "";
        return lang.toLowerCase().trim();
    }

    function getBaseLanguage(lang) {
        if (!lang) return "";
        return lang.split("-")[0];
    }

    function normalizeAllowedTags(tags) {
        if (!Array.isArray(tags) || tags.length === 0) {
            return DEFAULT_OPTIONS.allowedTags.slice();
        }

        return tags
            .map((tag) => String(tag).toLowerCase().trim())
            .filter(Boolean);
    }

    function detectLanguage(nav) {
        const hash = (global.location && global.location.hash) || "";
        const hPrefix = runtime.options ? runtime.options.hashPrefix : DEFAULT_OPTIONS.hashPrefix;
        const hashMatch = hash.match(new RegExp(`#${hPrefix}([a-z]{2}(-[a-z]{2})?)`, "i"));
        if (hashMatch) {
            return normalizeLanguage(hashMatch[1]);
        }

        if (global.location && global.location.search) {
            const qParam = runtime.options ? runtime.options.queryParameter : DEFAULT_OPTIONS.queryParameter;
            const urlParams = new URLSearchParams(global.location.search);
            const qValue = urlParams.get(qParam);
            if (qValue) {
                return normalizeLanguage(qValue);
            }
        }

        const browserNavigator = nav || global.navigator || {};
        const languages = browserNavigator.languages && browserNavigator.languages.length
            ? browserNavigator.languages
            : [browserNavigator.language];
        return normalizeLanguage(languages.find(Boolean));
    }

    function resolveOptions(options) {
        const resolved = Object.assign({}, DEFAULT_OPTIONS, options || {});
        resolved.root = resolved.root || global.document;
        resolved.lang = normalizeLanguage(resolved.lang) || detectLanguage();
        resolved.defaultLang = normalizeLanguage(resolved.defaultLang) || DEFAULT_OPTIONS.defaultLang;
        resolved.allowedTags = normalizeAllowedTags(resolved.allowedTags);
        return resolved;
    }

    function getAttributeName(options, suffix) {
        return `${options.attributePrefix}-${options.lang}${suffix}`;
    }

    function buildSelector(options) {
        return "*";
    }

    function getTargets(root, selector, options) {
        if (!root) return [];
        const targets = [];
        const prefix = `${options.attributePrefix}-`;

        const all = [];
        if (root.nodeType === 1) all.push(root);
        if (root.querySelectorAll) {
            all.push(...Array.from(root.querySelectorAll(selector)));
        }

        all.forEach((el) => {
            if (!el.attributes) return;
            for (let i = 0; i < el.attributes.length; i++) {
                const name = el.attributes[i].name;
                if (name.startsWith(prefix)) {
                    if (name === options.blockAttribute || name === options.cloakAttribute) {
                        continue;
                    }
                    targets.push(el);
                    break;
                }
            }
        });

        return Array.from(new Set(targets));
    }

    function hasI18nAttribute(el, attributePrefix) {
        const prefix = `${attributePrefix}-`;
        return Array.from(el.attributes || []).some((attr) => attr.name.startsWith(prefix));
    }

    function getTextSnapshot(el) {
        if (el.tagName === "META") return el.getAttribute("content") || "";
        if (el.tagName === "TITLE") return el.textContent || "";
        return el.innerHTML;
    }

    function ensureDefaultLanguageAttributes(targets, options) {
        const prefix = `${options.attributePrefix}-`;
        const defaultLang = options.defaultLang;
        const defaultPrefix = `${options.attributePrefix}-${defaultLang}`;

        targets.forEach((el) => {
            const i18nAttrs = Array.from(el.attributes).filter((attr) => attr.name.startsWith(prefix));
            if (i18nAttrs.length === 0) return;

            const targetNames = new Set();
            i18nAttrs.forEach((attr) => {
                const attrSepIdx = attr.name.indexOf(options.attributeSeparator);
                if (attrSepIdx !== -1) {
                    const targetName = attr.name.slice(attrSepIdx + options.attributeSeparator.length);
                    if (targetName) targetNames.add(targetName);
                } else {
                    targetNames.add(""); 
                }
            });

            targetNames.forEach((targetName) => {
                const isText = targetName === "";
                const defaultAttrName = isText ? defaultPrefix : `${defaultPrefix}${options.attributeSeparator}${targetName}`;
                
                if (!el.hasAttribute(defaultAttrName)) {
                    if (isText) {
                        el.setAttribute(defaultAttrName, getTextSnapshot(el));
                    } else {
                        const sourceValue = el.getAttribute(targetName);
                        if (sourceValue !== null) {
                            el.setAttribute(defaultAttrName, sourceValue);
                        }
                    }
                }
            });
        });
    }

    function allowsHtml(translated, options) {
        if (!translated) return false;
        if (options.allowHtml === true) return true;
        if (options.allowHtml !== "br") return false;
        return /<br\s*\/?>/i.test(translated);
    }

    function sanitizeHtml(html, options) {
        if (options.allowHtml !== true) return html;

        const template = global.document.createElement("template");
        template.innerHTML = html;
        const allowedTags = new Set((options.allowedTags || []).map((tag) => tag.toLowerCase()));

        template.content.querySelectorAll("*").forEach((el) => {
            const tagName = el.tagName.toLowerCase();

            if (!allowedTags.has(tagName)) {
                el.replaceWith(global.document.createTextNode(el.textContent));
                return;
            }

            Array.from(el.attributes).forEach((attr) => {
                const name = attr.name.toLowerCase();
                const value = attr.value.trim();

                if (name.startsWith("on")) {
                    el.removeAttribute(attr.name);
                    return;
                }

                if (name === "href" && !isSafeHref(value)) {
                    el.removeAttribute(attr.name);
                    return;
                }

                if (name === "src" && /^javascript:/i.test(value)) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return template.innerHTML;
    }

    function isSafeHref(value) {
        if (!value) return true;

        const trimmed = value.trim();
        if (!trimmed) return true;

        if (
            trimmed.startsWith("#")
            || trimmed.startsWith("/")
            || trimmed.startsWith("./")
            || trimmed.startsWith("../")
            || trimmed.startsWith("?")
        ) {
            return true;
        }

        const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
        if (!schemeMatch) {
            return true;
        }

        const scheme = schemeMatch[1].toLowerCase();
        return scheme === "http" || scheme === "https" || scheme === "mailto" || scheme === "tel";
    }

    function renderText(el, translated, options) {
        if (el.tagName === "META") {
            el.setAttribute("content", translated);
            return;
        }

        if (el.tagName === "TITLE") {
            el.textContent = translated;
            global.document.title = translated;
            return;
        }

        if (allowsHtml(translated, options)) {
            if (options.allowHtml === "br") {
                el.textContent = "";

                translated.split(/<br\s*\/?>/i).forEach((part, index) => {
                    if (index > 0) {
                        el.append(global.document.createElement("br"));
                    }

                    el.append(global.document.createTextNode(part));
                });

                return;
            }

            el.innerHTML = sanitizeHtml(translated, options);
            return;
        }

        el.textContent = translated;
    }

    function applyTranslation(el, options) {
        let applied = false;
        const prefix = `${options.attributePrefix}-`;
        const currentLocale = options.lang;
        const baseLang = getBaseLanguage(currentLocale);
        
        const candidateLocales = [currentLocale];
        if (baseLang && baseLang !== currentLocale) {
            candidateLocales.push(baseLang);
        }

        const translations = {}; 

        Array.from(el.attributes).forEach((attr) => {
            const name = attr.name;
            if (!name.startsWith(prefix)) return;

            const suffix = name.slice(prefix.length);
            
            candidateLocales.forEach((loc, index) => {
                const priority = candidateLocales.length - index;
                
                if (suffix === loc) {
                    if (!translations[""] || translations[""].priority < priority) {
                        translations[""] = { value: attr.value, priority };
                    }
                }
                
                const attrPrefix = `${loc}${options.attributeSeparator}`;
                if (suffix.startsWith(attrPrefix)) {
                    const targetAttr = suffix.slice(attrPrefix.length);
                    if (targetAttr && (!translations[targetAttr] || translations[targetAttr].priority < priority)) {
                        translations[targetAttr] = { value: attr.value, priority };
                    }
                }
            });
        });

        Object.keys(translations).forEach((target) => {
            const val = translations[target].value;
            if (target === "") {
                renderText(el, val, options);
            } else {
                el.setAttribute(target, val);
            }
            applied = true;
        });

        return applied;
    }

    function apply(options) {
        const resolved = resolveOptions(options);

        // Backward compatibility: set global language as early as possible
        const baseLang = getBaseLanguage(resolved.lang);
        global.__MYTORY_LANG__ = baseLang;

        if (!resolved.root || !resolved.lang) {
            return {
                lang: resolved.lang,
                baseLang: baseLang,
                defaultLang: resolved.defaultLang,
                translatedCount: 0,
            };
        }

        const selector = buildSelector(resolved);
        const targets = getTargets(resolved.root, selector, resolved);

        ensureDefaultLanguageAttributes(targets, resolved);

        let translatedCount = 0;

        targets.forEach((el) => {
            if (applyTranslation(el, resolved)) {
                translatedCount += 1;
            }
        });

        const blockSelector = `[${resolved.blockAttribute}]`;
        const blocks = [];
        if (resolved.root.nodeType === 1 && resolved.root.hasAttribute(resolved.blockAttribute)) {
            blocks.push(resolved.root);
        }
        if (resolved.root.querySelectorAll) {
            blocks.push(...Array.from(resolved.root.querySelectorAll(blockSelector)));
        }

        blocks.forEach((el) => {
            const attrValue = el.getAttribute(resolved.blockAttribute) || "";
            const allowedLangs = attrValue.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
            if (allowedLangs.length > 0) {
                const currentLocale = resolved.lang;
                const currentBase = getBaseLanguage(currentLocale);
                if (allowedLangs.indexOf(currentLocale) !== -1 || (currentBase && allowedLangs.indexOf(currentBase) !== -1)) {
                    el.removeAttribute("hidden");
                    el.style.removeProperty("display");
                } else {
                    el.setAttribute("hidden", "");
                    el.style.display = "none";
                }
            }
        });

        if (translatedCount > 0 || resolved.lang === resolved.defaultLang || baseLang === resolved.defaultLang) {
            if (resolved.setDocumentLang && global.document && global.document.documentElement) {
                global.document.documentElement.lang = resolved.lang;
            }
        }

        const cloakSelector = `[${resolved.cloakAttribute}]`;
        const cloaks = [];
        if (resolved.root.nodeType === 1 && resolved.root.hasAttribute(resolved.cloakAttribute)) {
            cloaks.push(resolved.root);
        }
        if (resolved.root.querySelectorAll) {
            cloaks.push(...Array.from(resolved.root.querySelectorAll(cloakSelector)));
        }
        cloaks.forEach((el) => {
            el.removeAttribute(resolved.cloakAttribute);
        });

        return {
            lang: resolved.lang,
            baseLang: baseLang,
            defaultLang: resolved.defaultLang,
            translatedCount,
        };
    }

    function init(options) {
        runtime.options = Object.assign({}, DEFAULT_OPTIONS, options || {});
        runtime.options.allowedTags = normalizeAllowedTags(runtime.options.allowedTags);

        const result = apply(runtime.options);
        runtime.currentLang = result.lang || "";
        runtime.options.lang = result.lang || runtime.options.lang || null;

        const sync = () => {
            const nextLang = detectLanguage();
            if (nextLang && nextLang !== runtime.currentLang) {
                setLanguage(nextLang);
            }
        };

        global.addEventListener("hashchange", sync);
        global.addEventListener("popstate", sync);

        return result;
    }

    function setOptions(nextOptions, applyNow) {
        const shouldApplyNow = applyNow !== false;
        runtime.options = Object.assign({}, runtime.options || DEFAULT_OPTIONS, nextOptions || {});
        runtime.options.allowedTags = normalizeAllowedTags(runtime.options.allowedTags);

        if (!shouldApplyNow) {
            return {
                options: Object.assign({}, runtime.options),
            };
        }

        const result = apply(runtime.options);
        runtime.currentLang = result.lang || runtime.currentLang;
        return result;
    }

    function reapply(nextOptions) {
        runtime.options = Object.assign({}, runtime.options || DEFAULT_OPTIONS, nextOptions || {});
        runtime.options.allowedTags = normalizeAllowedTags(runtime.options.allowedTags);

        const result = apply(runtime.options);
        runtime.currentLang = result.lang || runtime.currentLang;
        return result;
    }

    function setLanguage(lang, nextOptions) {
        const normalizedLang = normalizeLanguage(lang);
        const patch = Object.assign({}, nextOptions || {}, { lang: normalizedLang });
        return reapply(patch);
    }

    function getLanguage() {
        if (runtime.currentLang) return runtime.currentLang;
        if (runtime.options && runtime.options.lang) return normalizeLanguage(runtime.options.lang);
        return detectLanguage();
    }

    function getOptions() {
        return Object.assign({}, runtime.options || DEFAULT_OPTIONS);
    }

    global.MytoryI18n = {
        VERSION,
        init,
        apply,
        reapply,
        setOptions,
        getOptions,
        setLanguage,
        getLanguage,
        detectLanguage,
        normalizeLanguage,
    };

    const bootOptions = global.MYTORY_I18N_OPTIONS || {};
    runtime.options = Object.assign({}, DEFAULT_OPTIONS, bootOptions);
    runtime.options.allowedTags = normalizeAllowedTags(runtime.options.allowedTags);

    if (bootOptions.autoApply === true) {
        init(bootOptions);
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = global.MytoryI18n;
    }
})(typeof window !== "undefined" ? window : global);
