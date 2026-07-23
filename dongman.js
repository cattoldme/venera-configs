/** @type {import('./_venera_.js')} */
class Dongman extends ComicSource {
    name = "咚漫漫画"
    key = "dongman"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/cattoldme/venera-configs@main/dongman.js"

    baseUrl = "https://www.dongmanmanhua.cn"

    get headers() {
        return {
            "referer": `${this.baseUrl}/`,
            "user-agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36"
        }
    }

    absoluteUrl(url) {
        if (!url) return ""
        if (url.startsWith("http")) return url
        if (url.startsWith("//")) return `https:${url}`
        return this.baseUrl + (url.startsWith("/") ? url : `/${url}`)
    }

    async getDocument(url) {
        const target = this.absoluteUrl(url)
        let lastError
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const res = await Network.get(target, this.headers)
                if (res.status !== 200) {
                    throw new Error(`咚漫请求失败: HTTP ${res.status} (${target})`)
                }
                return new HtmlDocument(res.body)
            } catch (error) {
                lastError = error
            }
        }
        throw lastError
    }

    comicFromElement(element) {
        const link = element.attributes["href"] || ""
        const title = element.querySelector("p.subj")?.text?.trim()
        const image = element.querySelector("img")
        const cover = image?.attributes["src"] || image?.attributes["data-src"] || ""
        if (!link || !title) return null
        return new Comic({
            id: link,
            title,
            cover: this.absoluteUrl(cover)
        })
    }

    explore = [
        {
            title: "咚漫漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                const document = await this.getDocument("/dailySchedule")
                const comics = document
                    .querySelectorAll("div#dailyList .daily_section li a, div.daily_lst.comp li a")
                    .map(element => this.comicFromElement(element))
                    .filter(comic => comic != null)
                return { "每日更新": comics }
            }
        }
    ]

    search = {
        load: async (keyword, _, page) => {
            const url = `/search?keyword=${encodeURIComponent(keyword)}&page=${page}`
            const document = await this.getDocument(url)
            const comics = document
                .querySelectorAll("#content > div.card_wrap.search ul:not(#filterLayer) li a")
                .map(element => this.comicFromElement(element))
                .filter(comic => comic != null)
            const hasNext = document.querySelector("div.more_area, div.paginate a[onclick] + a") != null
            return {
                comics,
                maxPage: hasNext ? page + 1 : page
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            let document = await this.getDocument(id)
            const title = document.querySelector("h1.subj, h3.subj")?.text?.trim() || "咚漫漫画"
            const detail = document.querySelector(".detail_header .info")
            const aside = document.querySelector("#_asideDetail")
            const coverElement =
                document.querySelector("#content > div.cont_box > div.detail_header > span.thmb img") ||
                document.querySelector(".detail_header .thmb img")
            const cover = this.absoluteUrl(
                coverElement?.attributes["src"] || coverElement?.attributes["data-src"] || ""
            )
            const author =
                detail?.querySelector(".author_area")?.text?.trim() ||
                detail?.querySelector(".author")?.text?.trim() ||
                ""
            const tags = new Map()
            const genres = detail?.querySelectorAll(".genre")?.map(e => e.text.trim()) || []
            if (genres.length) tags.set("类型", genres)
            if (author) tags.set("作者", [author])

            const chapters = new Map()
            const visitedPages = new Set()
            while (document) {
                for (const item of document.querySelectorAll("ul#_listUl li")) {
                    const link = item.querySelector("a")
                    const epUrl = link?.attributes["href"] || ""
                    const epTitle =
                        item.querySelector("span.subj span")?.text?.trim() ||
                        item.querySelector("span.subj")?.text?.trim() ||
                        "章节"
                    if (epUrl) chapters.set(epUrl, epTitle)
                }
                const next = document.querySelector("div.paginate a[onclick] + a")
                const nextUrl = next?.attributes["href"]
                if (!nextUrl || visitedPages.has(nextUrl)) {
                    document = null
                } else {
                    visitedPages.add(nextUrl)
                    try {
                        document = await this.getDocument(nextUrl)
                    } catch (_) {
                        // Keep the chapters already parsed when the site drops
                        // a TLS connection on a later pagination request.
                        document = null
                    }
                }
            }

            return new ComicDetails({
                title,
                subtitle: author,
                cover,
                description: aside?.querySelector("p.summary")?.text?.trim() || "",
                tags,
                chapters,
                url: this.absoluteUrl(id)
            })
        },

        loadEp: async (_, epId) => {
            const document = await this.getDocument(epId)
            const images = document
                .querySelectorAll("div#_imageList > img")
                .map(image => image.attributes["data-url"] || image.attributes["src"])
                .filter(url => !!url)
            return { images }
        },

        onImageLoad: () => ({ headers: this.headers })
    }
}
