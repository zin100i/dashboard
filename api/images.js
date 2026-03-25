/**
 * images/ 폴더에서 bg숫자.jpg 형식 파일 목록 반환
 */
const fs   = require('fs');
const path = require('path');

module.exports = function handler(req, res) {
  const dir = path.join(process.cwd(), 'images');

  try {
    const files = fs.readdirSync(dir)
      .filter(f => /^bg\d+\.jpg$/i.test(f))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)[0], 10);
        const nb = parseInt(b.match(/\d+/)[0], 10);
        return na - nb;
      })
      .map(f => 'images/' + f);

    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).json({ images: files });
  } catch (e) {
    return res.status(500).json({ error: e.message, images: [] });
  }
};
