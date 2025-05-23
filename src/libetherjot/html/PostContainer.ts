import { Arrays } from 'cafe-utility'
import { Article, GlobalState } from '../engine/GlobalState'
import { createPost } from './Post'
import defaultImage from '../../static/media/default.jpg'

export function createPostContainer(globalState: GlobalState, depth: number, filter?: string): string {
    if (filter) {
        const articles = globalState.articles.filter(x => x.category === filter || x.tags.includes(filter))
        return `
            <div class="post-container post-container-regular">
                ${articles.map(x => buildArticle(globalState, x, 'regular', depth)).join('\n')}
            </div>
        `
    }
    if (globalState.configuration.main.highlight) {
        const highlight = globalState.configuration.main.highlight
        for (const article of globalState.articles) {
            if (article.kind !== 'regular') {
                continue
            }
            if (article.category !== highlight) {
                continue
            }
            article.kind = 'highlight'
        }
    }
    const limits = {
        h1: 1,
        h2: 2,
        highlight: 4,
        regular: 12
    }
    const articles = Arrays.organiseWithLimits(
        globalState.articles,
        limits,
        'kind',
        'regular',
        (a, b) => b.createdAt - a.createdAt
    )
    const innerHtmlH1 = `${articles.h1.map(x => buildArticle(globalState, x, 'h1', depth)).join('\n')}`
    const innerHtmlRegular1 = `${articles.regular
        .slice(0, 4)
        .map(x => buildArticle(globalState, x, 'regular', depth))
        .join('\n')}`
    const innerHtmlH2 = `${articles.h2.map(x => buildArticle(globalState, x, 'h2', depth)).join('\n')}`
    const innerHtmlHighlight = `${articles.highlight
        .map(x => buildArticle(globalState, x, 'highlight', depth))
        .join('\n')}`
    const innerHtmlRegular2 = `${articles.regular
        .slice(4, 12)
        .map(x => buildArticle(globalState, x, 'regular', depth))
        .join('\n')}`
    return `
        ${innerHtmlH1 ? `<div class="post-container-h1">${innerHtmlH1}</div>` : ''}
        ${maybeSurround(globalState, innerHtmlRegular1, 'regular')}
        ${maybeSurround(globalState, innerHtmlH2, 'h2')}
        ${maybeSurround(globalState, innerHtmlHighlight, 'highlight')}
        ${maybeSurround(globalState, innerHtmlRegular2, 'regular')}
    `
}

function maybeSurround(globalState: GlobalState, string: string, kind: string): string {
    if (string && kind === 'highlight') {
        return `
            <div class="highlight">
                <h2>${globalState.configuration.main?.highlight}</h2>
                <div class="post-container post-container-${kind}">
                    ${string}
                </div>
            </div>`
    }
    return string ? `<div class="post-container post-container-${kind}">${string}</div>` : ''
}

function buildArticle(
    globalState: GlobalState,
    x: Article,
    as: 'h1' | 'h2' | 'highlight' | 'regular',
    depth: number
): string {
    return createPost(
        globalState,
        x.title,
        x.preview,
        x.category,
        x.tags,
        x.createdAt,
        x.path,
        x.banner || defaultImage,
        as,
        depth
    )
}
