const BOT_UA = /bot\b|crawler|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|slackbot|discordbot|telegrambot|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|pagespeed|pingdom|uptimerobot|semrush|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|amazonbot|applebot|duckduckbot|baiduspider|yandexbot|sogou|ia_archiver|wget\/|curl\/|python-requests|go-http-client|libwww-perl|scrapy|httpclient|skypeuripreview|twitterbot|linkedinbot|pinterest|redditbot|storebot/i;
export function isObviousBot(input) {
    if (input.verifiedBot === true)
        return true;
    const ua = input.userAgent?.trim();
    if (!ua)
        return false;
    return BOT_UA.test(ua);
}
//# sourceMappingURL=bots.js.map