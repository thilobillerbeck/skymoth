import { convert } from 'html-to-text';

export function htmlToText(html: string) {
    return convert(html, {
        wordwrap: false,
    });
}

export async function fetchImageToBytes(url: string) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get('content-type');
    return {arrayBuffer, mimeType};
}

export function domainToUrl(domain: string) {
    return `https://${domain}/`
}

export function genCallBackUrl(instanceDomain: string) {
    if (process.env.NODE_ENV == 'development') {
        const { ADDRESS = 'localhost', PORT = '3000' } = process.env;
        return `http://${ADDRESS}:${PORT}/auth/callback/${btoa(instanceDomain)}`
    }
    return `${process.env.APP_URL}/auth/callback/${btoa(instanceDomain)}`
}

export const authenticateJWT = async (req: any, res: any) => {
    try {
        await req.jwtVerify()
    } catch (err) {
        res.redirect('/login')
    }
}