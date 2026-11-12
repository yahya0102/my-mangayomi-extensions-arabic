const mangayomiSources = [{
    "name": "مانجا ليك",
    "lang": "ar",
    "baseUrl": "https://mangalik.net",
    "apiUrl": "",
    "iconUrl": "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://mangalik.net&size=256",
    "typeSource": "single",
    "itemType": 0,
    "isNsfw": false,
    "version": "0.0.9",
    "pkgPath": "",
    "notes": ""
}];

let _sharedClient = null;

function getSharedClient() {
    if (!_sharedClient) {
        _sharedClient = new Client({
            'useCFClearance': true,
            'followRedirects': true,
        });
    }
    return _sharedClient;
}

class DefaultExtension extends MProvider {

    getHeaders(url) {
        return {
            "Referer": "https://mangalik.net/",
            "Origin": "https://mangalik.net",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "max-age=0",
            "Upgrade-Insecure-Requests": "1",
        };
    }

    getAjaxHeaders() {
        return {
            "Referer": "https://mangalik.net/",
            "Origin": "https://mangalik.net",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        };
    }

    getImageHeaders() {
        return {
            "Referer": "https://mangalik.net/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        };
    }

    // ✅ تم إصلاح صيغة استدعاء client.get لتطابق التوثيق الرسمي:
    // client.get(url, headersObject) بدون تغليف الـ headers داخل { headers: ... }
    async request(url) {
        const client = getSharedClient();
        const res = await client.get(url, this.getHeaders(url));
        return new Document(res.body);
    }

    _bestImage(imgEl) {
    if (!imgEl) return "";

    // ✅ أولاً: data-src مع trim (الأكثر شيوعاً وأعلى جودة)
    const dataSrc = (imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || "").trim();
    if (dataSrc && !dataSrc.startsWith("data:")) return dataSrc;

    // ثانياً: srcset — نأخذ الأعرض (أعلى جودة)
    const srcset = imgEl.attr("srcset");
    if (srcset) {
        const candidates = srcset.split(",")
            .map(s => s.trim())
            .map(s => {
                const parts = s.split(/\s+/);
                const url = parts[0].trim();
                const width = parseInt((parts[1] || "0").replace("w", ""), 10) || 0;
                return { url, width };
            })
            .filter(c => c.url && !c.url.startsWith("data:"));
        if (candidates.length > 0) {
            candidates.sort((a, b) => b.width - a.width);
            return candidates[0].url;
        }
    }

    // أخيراً: src العادي
    const src = (imgEl.attr("src") || "").trim();
    return src.startsWith("data:") ? "" : src;
}

    _parseMangaCard(el) {
        const link = el.selectFirst(".item-thumb a") || el.selectFirst(".post-title a");
        const img = el.selectFirst(".item-thumb img");
        const titleEl = el.selectFirst(".post-title a");
        const name = titleEl?.text?.trim() || link?.attr("title")?.trim() || "بدون عنوان";
        const href = link?.attr("href") || "";
        const imageUrl = this._bestImage(img);
        return { name, imageUrl, link: href };
    }

    _parseList(doc) {
        const cards = doc.select("div.page-item-detail");
        const list = cards
            .map((el) => this._parseMangaCard(el))
            .filter(item => item.link);
        const hasNextPage = !!doc.selectFirst("div.nav-previous a, .wp-pagenavi a.next, link[rel='next']");
        return { list, hasNextPage };
    }

    _parseSearchList(doc) {
        const items = doc.select(".c-tabs-item__content");
        const list = items.map((el) => {
            const linkEl = el.selectFirst(".tab-thumb a") || el.selectFirst(".post-title a");
            const imgEl  = el.selectFirst(".tab-thumb img");
            const titleEl = el.selectFirst(".post-title a");
            const name = titleEl?.text?.trim() || linkEl?.attr("title")?.trim() || "بدون عنوان";
            const href = linkEl?.attr("href") || "";
            const imageUrl = this._bestImage(imgEl);
            return { name, imageUrl, link: href };
        }).filter(item => item.link);
        const hasNextPage = !!doc.selectFirst(".wp-pagenavi a.next, .nav-previous a");
        return { list, hasNextPage };
    }

    async getPopular(page) {
        const url = `${this.source.baseUrl}/manga/page/${page}/?m_orderby=views`;
        const doc = await this.request(url);
        return this._parseList(doc);
    }

    async getLatestUpdates(page) {
        const url = page > 1
            ? `${this.source.baseUrl}/page/${page}/`
            : `${this.source.baseUrl}/`;
        const doc = await this.request(url);
        return this._parseList(doc);
    }

    async search(query, page, filters) {
        if (query && query.trim().length > 0) {
            const pageParam = page > 1 ? `&paged=${page}` : "";
            const url = `${this.source.baseUrl}/?s=${encodeURIComponent(query.trim())}&post_type=wp-manga${pageParam}`;
            const doc = await this.request(url);
            return this._parseSearchList(doc);
        }
        const genreFilter = filters?.[0]?.state ?? 0;
        const genreValue = this.getFilterList()[0]?.values[genreFilter]?.value || "";
        let url;
        if (genreValue) {
            const pagePath = page > 1 ? `page/${page}/` : "";
            url = `${this.source.baseUrl}/manga-genre/${genreValue}/${pagePath}`;
        } else {
            url = `${this.source.baseUrl}/manga/page/${page}/`;
        }
        const doc = await this.request(url);
        return this._parseList(doc);
    }

    // ✅ الإصلاح الرئيسي: تحويل التاريخ العربي إلى millisecondsSinceEpoch
    _parseDate(dateEl) {
        if (!dateEl) return "0";

        // جرب title attribute أولاً (قد يحتوي على تاريخ ميلادي)
        const title = dateEl.attr("title");
        const rawText = (title && title.trim()) ? title.trim() : (dateEl.text?.trim() || "");
        if (!rawText) return "0";

        // خريطة الأشهر العربية
        const arabicMonths = {
            'يناير': 0, 'جانفي': 0,
            'فبراير': 1, 'شباط': 1,
            'مارس': 2, 'آذار': 2,
            'أبريل': 3, 'ابريل': 3, 'نيسان': 3,
            'مايو': 4, 'أيار': 4,
            'يونيو': 5, 'حزيران': 5,
            'يوليو': 6, 'تموز': 6,
            'أغسطس': 7, 'اغسطس': 7, 'آب': 7,
            'سبتمبر': 8, 'أيلول': 8,
            'أكتوبر': 9, 'اكتوبر': 9, 'تشرين الأول': 9,
            'نوفمبر': 10, 'تشرين الثاني': 10,
            'ديسمبر': 11, 'كانون الأول': 11,
        };

        for (const [monthAr, monthIdx] of Object.entries(arabicMonths)) {
            if (rawText.includes(monthAr)) {
                // نزع اسم الشهر والفاصلة وتقسيم الباقي
                const cleaned = rawText.replace(monthAr, ' ').replace(/,/g, ' ').trim();
                const numbers = cleaned.split(/\s+/).map(n => parseInt(n, 10)).filter(n => !isNaN(n));
                if (numbers.length >= 2) {
                    // الموقع يكتب: "سبتمبر 10, 2023" → day=10, year=2023
                    const day  = numbers[0] <= 31 ? numbers[0] : numbers[1];
                    const year = numbers[0] > 31  ? numbers[0] : numbers[1];
                    if (day && year && year > 1900) {
                        return String(new Date(year, monthIdx, day).getTime());
                    }
                }
                break;
            }
        }

        // حاول parse مباشر (للتواريخ الإنجليزية مثل "2023-09-10")
        const direct = Date.parse(rawText);
        if (!isNaN(direct)) return String(direct);

        // التواريخ النسبية مثل "منذ يومين" → استخدم تاريخ اليوم تقريباً
        if (rawText.includes('منذ') || rawText.includes('ago')) {
            return String(Date.now());
        }

        return "0";
    }

    async getDetail(url) {
        const doc = await this.request(url);

        const title = doc.selectFirst(".post-title h1")?.text?.trim() || "بدون عنوان";

        // محاولات متعددة لجلب الصورة
        const imgEl = doc.selectFirst(".summary_image img")
                   || doc.selectFirst(".tab-summary img")
                   || doc.selectFirst(".manga-thumbnail img");
        const imageUrl = this._bestImage(imgEl);

        const descEl = doc.selectFirst(".description-summary .summary__content, .summary__content");
        const description = descEl?.text?.trim() || "";
        const author = doc.selectFirst(".author-content a")?.text?.trim() || "";
        const genre = doc.select(".genres-content a").map(el => el.text.trim());

        const statusText = doc.selectFirst(".post-status .summary-content")?.text?.trim() || "";
        let status = 5;
        if (/مستمر/i.test(statusText)) status = 0;
        else if (/مكتمل/i.test(statusText)) status = 1;
        else if (/متوقف/i.test(statusText)) status = 2;
        else if (/ملغي/i.test(statusText)) status = 3;

        const mangaId = doc.selectFirst("#manga-chapters-holder")?.attr("data-id") || "";

        let chapters = [];
        if (mangaId) {
            try {
                const client = getSharedClient();
                const ajaxUrl = `${this.source.baseUrl}/wp-admin/admin-ajax.php`;
                const body = `action=manga_get_chapters&manga=${mangaId}`;
                // ✅ تم إصلاح صيغة استدعاء client.post: (url, headers, body) كـ 3 parameters منفصلة
                const res = await client.post(ajaxUrl, this.getAjaxHeaders(), body);
                if (res.body && res.body.trim().length > 10) {
                    const chDoc = new Document(res.body);
                    chapters = this._parseChapters(chDoc);
                }
                // إذا رجع AJAX فارغاً، استخدم الصفحة الأصلية
                if (chapters.length === 0) {
                    chapters = this._parseChapters(doc);
                }
            } catch (e) {
                chapters = this._parseChapters(doc);
            }
        } else {
            chapters = this._parseChapters(doc);
        }

        return { title, imageUrl, description, author: author || null, status, genre, chapters };
    }

    _parseChapters(doc) {
        // ✅ جرب كلا الـ selectors (بمسافة وبدونها)
        let chapterElements = doc.select("li.wp-manga-chapter");
        if (!chapterElements || chapterElements.length === 0) {
            chapterElements = doc.select("ul.main li");
        }

        const results = [];
        for (const el of (chapterElements || [])) {
            try {
                const a = el.selectFirst("a");
                if (!a) continue;

                const chUrl = a.attr("href") || "";
                if (!chUrl) continue;

                const chName = a.text?.trim() || "فصل";

                // ✅ جرب كل الطرق الممكنة للتاريخ
                const dateEl = el.selectFirst(".chapter-release-date i")
                    || el.selectFirst(".chapter-release-date a")
                    || el.selectFirst(".chapter-release-date")
                    || el.selectFirst(".post-on i")
                    || el.selectFirst(".post-on span")
                    || el.selectFirst(".post-on");

                results.push({
                    name: chName,
                    url: chUrl,
                    dateUpload: this._parseDate(dateEl),
                    scanlator: "",
                });
            } catch (e) {
                // تجاهل الفصل المعطوب وكمّل
            }
        }
        return results;
    }

   async getPageList(url) {
    const doc = await this.request(url);

    let images = doc.select(".reading-content img");
    if (!images || images.length === 0) {
        images = doc.select(".page-break img");
    }
    if (!images || images.length === 0) {
        images = doc.select("img.wp-manga-chapter-img");
    }

    return (images || [])
        .map((img) => {
            // ✅ trim() مهم جداً — WordPress يضيف \n ومسافات في data-src
            const rawUrl = (
                img.attr("data-src") ||
                img.attr("data-lazy-src") ||
                img.attr("data-full-src") ||   // ← نسخة كاملة الجودة
                img.attr("src") ||
                ""
            ).trim();   // ← هذا هو الإصلاح الأساسي

            // إزالة أي query parameters تقلل الجودة مثل ?resize=... أو ?w=...
            let finalUrl = rawUrl;
            try {
                const u = new URL(rawUrl);
                // إذا كان الموقع يستخدم Jetpack image CDN يقلل الجودة
                if (u.searchParams.has("resize") || u.searchParams.has("w")) {
                    u.searchParams.delete("resize");
                    u.searchParams.delete("w");
                    u.searchParams.delete("h");
                    u.searchParams.delete("fit");
                    u.searchParams.delete("quality");
                    finalUrl = u.toString();
                }
            } catch (e) {
                // URL غير صالح، استخدم الأصلي
            }

            return {
                url: finalUrl,
                headers: this.getImageHeaders(),
            };
        })
        .filter(item => item.url && !item.url.startsWith("data:"));
}

    getFilterList() {
        const genres = [
            { name: "+18", value: "18" },
            { name: "إدارة المناطق", value: "%d8%a5%d8%af%d8%a7%d8%b1%d8%a9-%d8%a7%d9%84%d9%85%d9%86%d8%a7%d8%b7%d9%82" },
            { name: "إنتقام", value: "%d8%a5%d9%86%d8%aa%d9%82%d8%a7%d9%85" },
            { name: "إيسيكاي", value: "%d8%a5%d9%8a%d8%b3%d9%8a%d9%83%d8%a7%d9%8a" },
            { name: "اثاره", value: "%d8%a7%d8%ab%d8%a7%d8%b1%d9%87" },
            { name: "اشباح", value: "%d8%a7%d8%b4%d8%a8%d8%a7%d8%ad" },
            { name: "اعادة احياء", value: "%d8%a7%d8%b9%d8%a7%d8%af%d8%a9-%d8%a7%d8%ad%d9%8a%d8%a7%d8%a1" },
            { name: "اكاديميه", value: "%d8%a7%d9%83%d8%a7%d8%af%d9%8a%d9%85%d9%8a%d9%87" },
            { name: "اكشن", value: "%d8%a7%d9%83%d8%b4%d9%86" },
            { name: "الحريم العكسي", value: "%d8%a7%d9%84%d8%ad%d8%b1%d9%8a%d9%85-%d8%a7%d9%84%d8%b9%d9%83%d8%b3%d9%8a" },
            { name: "الحياة المدرسيه", value: "%d8%a7%d9%84%d8%ad%d9%8a%d8%a7%d8%a9-%d8%a7%d9%84%d9%85%d8%af%d8%b1%d8%b3%d9%8a%d9%87" },
            { name: "الحياة اليومية", value: "%d8%a7%d9%84%d8%ad%d9%8a%d8%a7%d8%a9-%d8%a7%d9%84%d9%8a%d9%88%d9%85%d9%8a%d8%a9" },
            { name: "النجاة", value: "%d8%a7%d9%84%d9%86%d8%ac%d8%a7%d8%a9" },
            { name: "امرأة شريرة", value: "%d8%a7%d9%85%d8%b1%d8%a3%d8%a9-%d8%b4%d8%b1%d9%8a%d8%b1%d8%a9" },
            { name: "ايتشى", value: "%d8%a7%d9%8a%d8%aa%d8%b4%d9%89" },
            { name: "ايسكاى", value: "%d8%a7%d9%8a%d8%b3%d9%83%d8%a7%d9%89" },
            { name: "بطل غير اعتيادى", value: "%d8%a8%d8%b7%d9%84-%d8%ba%d9%8a%d8%b1-%d8%a7%d8%b9%d8%aa%d9%8a%d8%a7%d8%af%d9%89" },
            { name: "بعد الكارثه", value: "%d8%a8%d8%b9%d8%af-%d8%a7%d9%84%d9%83%d8%a7%d8%b1%d8%ab%d9%87" },
            { name: "تاريخى", value: "%d8%aa%d8%a7%d8%b1%d9%8a%d8%ae%d9%89" },
            { name: "تجسيد", value: "%d8%aa%d8%ac%d8%b3%d9%8a%d8%af" },
            { name: "تراجيدي", value: "%d8%aa%d8%b1%d8%a7%d8%ac%d9%8a%d8%af%d9%8a" },
            { name: "تشويق", value: "%d8%aa%d8%b4%d9%88%d9%8a%d9%82" },
            { name: "تناسخ", value: "%d8%aa%d9%86%d8%a7%d8%b3%d8%ae" },
            { name: "جريمة", value: "%d8%ac%d8%b1%d9%8a%d9%85%d8%a9" },
            { name: "جوسى", value: "%d8%ac%d9%88%d8%b3%d9%89" },
            { name: "جوسيه", value: "%d8%ac%d9%88%d8%b3%d9%8a%d9%87" },
            { name: "حرب", value: "%d8%ad%d8%b1%d8%a8" },
            { name: "حربى", value: "%d8%ad%d8%b1%d8%a8%d9%89" },
            { name: "حريم", value: "%d8%ad%d8%b1%d9%8a%d9%85" },
            { name: "حياة مدرسية", value: "%d8%ad%d9%8a%d8%a7%d8%a9-%d9%85%d8%af%d8%b1%d8%b3%d9%8a%d8%a9" },
            { name: "حياة يومية", value: "%d8%ad%d9%8a%d8%a7%d8%a9-%d9%8a%d9%88%d9%85%d9%8a%d8%a9" },
            { name: "خارق للطبيعه", value: "%d8%ae%d8%a7%d8%b1%d9%82-%d9%84%d9%84%d8%b7%d8%a8%d9%8a%d8%b9%d9%87" },
            { name: "خيال", value: "%d8%ae%d9%8a%d8%a7%d9%84" },
            { name: "خيال علمى", value: "%d8%ae%d9%8a%d8%a7%d9%84-%d8%b9%d9%84%d9%85%d9%89" },
            { name: "دراما", value: "%d8%af%d8%b1%d8%a7%d9%85%d8%a7" },
            { name: "دموى", value: "%d8%af%d9%85%d9%88%d9%89" },
            { name: "رعب", value: "%d8%b1%d8%b9%d8%a8" },
            { name: "رومانسى", value: "%d8%b1%d9%88%d9%85%d8%a7%d9%86%d8%b3%d9%89" },
            { name: "رياضه", value: "%d8%b1%d9%8a%d8%a7%d8%b6%d9%87" },
            { name: "زمكانى", value: "%d8%b2%d9%85%d9%83%d8%a7%d9%86%d9%89" },
            { name: "زمنكاني", value: "%d8%b2%d9%85%d9%86%d9%83%d8%a7%d9%86%d9%8a" },
            { name: "زومبي", value: "%d8%b2%d9%88%d9%85%d8%a8%d9%8a" },
            { name: "ساموراي", value: "%d8%b3%d8%a7%d9%85%d9%88%d8%b1%d8%a7%d9%8a" },
            { name: "سحر", value: "%d8%b3%d8%ad%d8%b1" },
            { name: "سينين", value: "%d8%b3%d9%8a%d9%86%d9%8a%d9%86" },
            { name: "شريحة من الحياة", value: "%d8%b4%d8%b1%d9%8a%d8%ad%d8%a9-%d9%85%d9%86-%d8%a7%d9%84%d8%ad%d9%8a%d8%a7%d8%a9" },
            { name: "شوجو", value: "%d8%b4%d9%88%d8%ac%d9%88" },
            { name: "شونين", value: "%d8%b4%d9%88%d9%86%d9%8a%d9%86" },
            { name: "شياطين", value: "%d8%b4%d9%8a%d8%a7%d8%b7%d9%8a%d9%86" },
            { name: "طبخ", value: "%d8%b7%d8%a8%d8%ae" },
            { name: "عالم مختلف", value: "%d8%b9%d8%a7%d9%84%d9%85-%d9%85%d8%ae%d8%aa%d9%84%d9%81" },
            { name: "عامل مكتبي", value: "%d8%b9%d8%a7%d9%85%d9%84-%d9%85%d9%83%d8%aa%d8%a8%d9%8a" },
            { name: "عسكري", value: "%d8%b9%d8%b3%d9%83%d8%b1%d9%8a" },
            { name: "غموض", value: "%d8%ba%d9%85%d9%88%d8%b6" },
            { name: "فانتازيا", value: "%d9%81%d8%a7%d9%86%d8%aa%d8%a7%d8%b2%d9%8a%d8%a7" },
            { name: "فنتازيا", value: "%d9%81%d9%86%d8%aa%d8%a7%d8%b2%d9%8a%d8%a7" },
            { name: "فنون قتاليه", value: "%d9%81%d9%86%d9%88%d9%86-%d9%82%d8%aa%d8%a7%d9%84%d9%8a%d9%87" },
            { name: "قوة خارقة", value: "%d9%82%d9%88%d8%a9-%d8%ae%d8%a7%d8%b1%d9%82%d8%a9" },
            { name: "كوميدى", value: "%d9%83%d9%88%d9%85%d9%8a%d8%af%d9%89" },
            { name: "مانجا", value: "%d9%85%d8%a7%d9%86%d8%ac%d8%a7" },
            { name: "مانها", value: "%d9%85%d8%a7%d9%86%d9%87%d8%a7" },
            { name: "مانهوا", value: "%d9%85%d8%a7%d9%86%d9%87%d9%88%d8%a7" },
            { name: "مانهوا (منها)", value: "manhua" },
            { name: "مجموعة قصص", value: "%d9%85%d8%ac%d9%85%d9%88%d8%b9%d8%a9-%d9%82%d8%b5%d8%b5" },
            { name: "مصاصى الدماء", value: "%d9%85%d8%b5%d8%a7%d8%b5%d9%89-%d8%a7%d9%84%d8%af%d9%85%d8%a7%d8%a1" },
            { name: "مغامرة", value: "%d9%85%d8%ba%d8%a7%d9%85%d8%b1%d8%a9" },
            { name: "نظام", value: "%d9%86%d8%b8%d8%a7%d9%85" },
            { name: "نفسى", value: "%d9%86%d9%81%d8%b3%d9%89" },
            { name: "نينجا", value: "%d9%86%d9%8a%d9%86%d8%ac%d8%a7" },
            { name: "واقعى", value: "%d9%88%d8%a7%d9%82%d8%b9%d9%89" },
            { name: "وحوش", value: "%d9%88%d8%ad%d9%88%d8%b4" },
            { name: "ون شوت", value: "%d9%88%d9%86-%d8%b4%d9%88%d8%aa" },
            { name: "ويب تون", value: "%d9%88%d9%8a%d8%a8-%d8%aa%d9%88%d9%86" },
            { name: "يورى", value: "%d9%8a%d9%88%d8%b1%d9%89" },
        ];

        return [
            {
                type_name: "SelectFilter",
                name: "التصنيف",
                values: [
                    { type_name: "SelectOption", name: "الكل", value: "" },
                    ...genres.map(g => ({
                        type_name: "SelectOption",
                        name: g.name,
                        value: g.value,
                    })),
                ],
            },
        ];
    }

    getSourcePreferences() {
        return [
            {
                key: "domain_url",
                editTextPreference: {
                    title: "تغيير الرابط الأساسي",
                    summary: "استخدم فقط إذا كان الموقع قد غير نطاقه",
                    value: "https://mangalik.net",
                    dialogTitle: "الرابط الأساسي",
                    dialogMessage: "أدخل الرابط الجديد",
                },
            },
        ];
    }
}