import JSZip from 'jszip';
import { svgToPng } from './svg-to-png';
import type { ConceptFile } from '$lib/types';

export async function exportMarkdown(file: ConceptFile): Promise<void> {
  const zip = new JSZip();
  const slug = file.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Generate PNG from current SVG
  const svgEl = document.querySelector('svg');
  let imageName = '';
  if (svgEl) {
    const png = await svgToPng(svgEl as SVGSVGElement);
    imageName = `${slug}-visualization.png`;
    zip.file(imageName, png);
  }

  // Build markdown
  let md = `# ${file.title}\n\n`;

  if (imageName) {
    md += `![${file.title}](./${imageName})\n\n`;
  }

  if (file.visualization) {
    md += `> ${file.visualization.description}\n\n`;

    if (file.visualization.metadata.concepts.length > 0) {
      md += `## Concepts\n\n`;
      file.visualization.metadata.concepts.forEach(c => { md += `- ${c}\n`; });
      md += '\n';
    }

    if (file.visualization.metadata.relationships.length > 0) {
      md += `## Relationships\n\n`;
      file.visualization.metadata.relationships.forEach(r => { md += `- ${r}\n`; });
      md += '\n';
    }
  }

  md += `## Explanation\n\n${file.text}\n`;

  zip.file(`${slug}.md`, md);

  // Download zip
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
