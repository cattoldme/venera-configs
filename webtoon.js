/** @type {import('./_venera_.js')} */
class Webtoon extends ComicSource {
    name = "WEBTOON"
    key = "webtoon"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/cattoldme/venera-configs@main/webtoon.js"

    baseUrl = "https://www.webtoons.com"
    mobileUrl = "https://m.webtoons.com"

    settings = {
        language: {
            title: "内容语言",
            type: "select",
            options: [
                { value: "zh-hant", text: "繁體中文" },
                { value: "en", text: "English" }
            ],
            default: "zh-hant"
        }
    }

    get language() {
        return this.loadSetting("language") || "zh-hant"
    }

    get headers() {
        return {
            "referer": `${this.baseUrl}/`,
            "cookie": `ageGatePass=true; locale=${this.language === "zh-hant" ? "zh_TW" : this.language}; needGDPR=false`,
            "user-agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36"
        }
    }

    absoluteUrl(url, base = this.baseUrl) {
        if (!url) return ""
        if (url.startsWith("http")) return url
        if (url.startsWith("//")) return `https:${url}`
        return base + (url.startsWith("/") ? url : `/${url}`)
    }

    async getDocument(url) {
        const res = await Network.get(this.absoluteUrl(url), this.headers)
        if (res.status !== 200) {
            throw new Error(`WEBTOON 请求失败: HTTP ${res.status}`)
        }
        return new HtmlDocument(res.body)
    }

    comicFromElement(element) {
        const link = element.attributes["href"] || ""
        const title = element.querySelector(".title")?.text?.trim()
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
            title: "WEBTOON",
            type: "singlePageWithMultiPart",
            load: async () => {
                const document = await this.getDocument(`/${this.language}/ranking/trending`)
                const comics = document
                    .querySelectorAll(".webtoon_list li a")
                    .map(element => this.comicFromElement(element))
                    .filter(comic => comic != null)
                return { "熱門作品": comics }
            }
        }
    ]

    search = {
        load: async (keyword, _, page) => {
            const document = await this.getDocument(
                `/${this.language}/search?keyword=${encodeURIComponent(keyword)}&page=${page}`
            )
            const comics = document
                .querySelectorAll(".webtoon_list li a")
                .map(element => this.comicFromElement(element))
                .filter(comic => comic != null)
            const hasNext = document.querySelector("a.pagination[aria-current=true] + a") != null
            return { comics, maxPage: hasNext ? page + 1 : page }
        }
    }

    comic = {
        loadInfo: async (id) => {
            const document = await this.getDocument(id)
            const detail = document.querySelector(".detail_header .info")
            const aside = document.querySelector("#_asideDetail")
            const title = document.querySelector("h1.subj, h3.subj")?.text?.trim() || "WEBTOON"
            const author =
                detail?.querySelector(".author_area")?.text?.trim() ||
                detail?.querySelector(".author")?.text?.trim() ||
                ""
            const cover =
                document.querySelector("head meta[property=\"og:image\"]")?.attributes["content"] ||
                document.querySelector(".detail_header .thmb img")?.attributes["src"] ||
                ""

            const titleNoMatch = this.absoluteUrl(id).match(/[?&](?:title_no|titleNo)=([^&#]+)/)
            const titleNo = titleNoMatch ? titleNoMatch[1] : null
            if (!titleNo) throw new Error("WEBTOON title_no 缺失")
            const isCanvas = id.includes("/canvas/") || id.includes("/challenge/")
            const type = isCanvas ? "canvas" : "webtoon"
            let api = `${this.mobileUrl}/api/v1/${type}/${titleNo}/episodes?pageSize=99999`
            if (isCanvas) api += `&readingLanguageCode=${this.language}`
            const chapterRes = await Network.get(api, {
                ...this.headers,
                "referer": `${this.mobileUrl}/`
            })
            if (chapterRes.status !== 200) {
                throw new Error(`WEBTOON 章节请求失败: HTTP ${chapterRes.status}`)
            }
            const episodeList = JSON.parse(chapterRes.body).result?.episodeList || []
            const chapters = new Map()
            for (const episode of episodeList.slice().reverse()) {
                chapters.set(episode.viewerLink, episode.episodeTitle)
            }

            const tags = new Map()
            const genres = detail?.querySelectorAll(".genre")?.map(e => e.text.trim()) || []
            if (genres.length) tags.set("类型", genres)
            if (author) tags.set("作者", [author])

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
            const res = await Network.get(this.absoluteUrl(epId), this.headers)
            if (res.status !== 200) {
                throw new Error(`WEBTOON 阅读页请求失败: HTTP ${res.status}`)
            }
            const document = new HtmlDocument(res.body)
            const images = document
                .querySelectorAll("div#_imageList > img")
                .map(image => image.attributes["data-url"])
                .filter(url => !!url)
            return { images }
        },

        onImageLoad: (url) => ({
            url: url.replace(/[?&]type=q90(&|$)/, "$1").replace(/[?&]$/, ""),
            headers: this.headers
        })
    }
}
