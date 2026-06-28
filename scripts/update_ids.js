const fs = require('fs');

const filePath = '/home/dylan/Documents/Projects/fvtt-ptr/packs/_source/journals/keywords-reference.json';

fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error(`Error reading file: ${err}`);
        return;
    }

    try {
        const json = JSON.parse(data);
        
        json.pages.forEach(page => {
            const name = page.name.replace(/\\s/g, '');
            const baseId = `kw${name}`;
            const paddedId = baseId.padEnd(16, '0');
            page._id = paddedId;
        });

        const newContent = JSON.stringify(json, null, 2);

        fs.writeFile(filePath, newContent, 'utf8', (err) => {
            if (err) {
                console.error(`Error writing file: ${err}`);
                return;
            }
            console.log('File updated successfully.');
        });
    } catch (e) {
        console.error(`Error parsing JSON or processing file: ${e}`);
    }
});
