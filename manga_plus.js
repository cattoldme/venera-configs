/** @type {import('./_venera_.js')} */
class MangaPlus extends ComicSource {
    name = "MANGA Plus"
    key = "manga_plus"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/cattoldme/venera-configs@main/manga_plus.js"

    baseUrl = "https://mangaplus.shueisha.co.jp"
    apiUrl = "https://jumpg-webapi.tokyo-cdn.com/api"

    uuid() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
            const r = Math.floor(Math.random() * 16)
            return (c === "x" ? r : (r & 3) | 8).toString(16)
        })
    }

    get headers() {
        return {
            "origin": this.baseUrl,
            "referer": `${this.baseUrl}/`,
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/118 Safari/537.36",
            "session-token": this.uuid()
        }
    }

    async request(path) {
        const res = await Network.get(`${this.apiUrl}/${path}`, this.headers)
        if (res.status !== 200) {
            throw new Error(`MANGA Plus 请求失败: HTTP ${res.status}`)
        }
        const data = JSON.parse(res.body)
        if (!data.success) {
            const popup = data.error?.popups?.find(item => item.language === "ENGLISH")
            throw new Error(popup?.body || "MANGA Plus 当前地区不可用")
        }
        return data.success
    }

    titleToComic(title) {
        return new Comic({
            id: String(title.titleId),
            title: title.name,
            subTitle: title.author || "",
            cover: title.portraitImageUrl || ""
        })
    }

    explore = [
        {
            title: "MANGA Plus",
            type: "singlePageWithMultiPart",
            load: async () => {
                const success = await this.request(
                    "title_list/rankingV2?lang=eng&type=hottest&clang=eng&format=json"
                )
                const titles = (success.titleRankingViewV2?.rankedTitles || [])
                    .flatMap(group => group.titles || [])
                    .filter(title => title.language === "ENGLISH")
                return { "热门作品": titles.map(title => this.titleToComic(title)) }
            }
        }
    ]

    search = {
        load: async (keyword, _, page) => {
            if (page > 1) return { comics: [], maxPage: 1 }
            const success = await this.request("title_list/allV2?format=json")
            const titles = (success.allTitlesViewV2?.AllTitlesGroup || [])
                .flatMap(group => group.titles || [])
                .filter(title =>
                    title.language === "ENGLISH" &&
                    (`${title.name} ${title.author || ""}`).toLowerCase().includes(keyword.toLowerCase())
                )
            return { comics: titles.map(title => this.titleToComic(title)), maxPage: 1 }
        }
    }

    comic = {
        loadInfo: async (id) => {
            const success = await this.request(`title_detailV3?title_id=${id}&format=json`)
            const detail = success.titleDetailView
            const title = detail.title
            const chapters = new Map()
            const groups = detail.chapterListGroup || []
            const chapterList = groups.flatMap(group =>
                (group.firstChapterList || []).concat(group.lastChapterList || [])
            )
            for (const chapter of chapterList) {
                if (chapter.subTitle != null) {
                    chapters.set(String(chapter.chapterId), `${chapter.name} - ${chapter.subTitle}`)
                }
            }
            const tags = new Map()
            if (title.author) tags.set("作者", [title.author])
            tags.set("语言", ["English"])
            return new ComicDetails({
                title: title.name,
                subtitle: title.author || "",
                cover: detail.titleImageUrl || title.portraitImageUrl || "",
                description: [detail.overview, detail.viewingPeriodDescription].filter(Boolean).join("\n\n"),
                tags,
                chapters,
                url: `${this.baseUrl}/titles/${id}`
            })
        },

        loadEp: async (_, epId) => {
            const success = await this.request(
                `manga_viewer?chapter_id=${epId}&split=yes&img_quality=super_high&format=json`
            )
            const images = (success.mangaViewer?.pages || [])
                .map(page => page.mangaPage)
                .filter(page => page != null)
                .map(page => page.encryptionKey
                    ? `${page.imageUrl}#mpkey=${page.encryptionKey}`
                    : page.imageUrl
                )
            return { images }
        },

        onImageLoad: (url) => {
            const marker = "#mpkey="
            if (!url.includes(marker)) {
                return { url, headers: this.headers }
            }
            const [cleanUrl, key] = url.split(marker)
            const keyBytes = []
            for (let i = 0; i < key.length; i += 2) {
                keyBytes.push(parseInt(key.slice(i, i + 2), 16))
            }
            return {
                url: cleanUrl,
                headers: this.headers,
                onResponse: buffer => {
                    const bytes = new Uint8Array(buffer)
                    for (let i = 0; i < bytes.length; i++) {
                        bytes[i] ^= keyBytes[i % keyBytes.length]
                    }
                    return buffer
                }
            }
        }
    }
}
