import type { ConceptFile } from '$lib/types';

export function exportPdf(file: ConceptFile): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const doc = printWindow.document;

  // Build head
  const title = doc.createElement('title');
  title.textContent = file.title;
  doc.head.appendChild(title);

  const style = doc.createElement('style');
  style.textContent = [
    'body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1f2937; }',
    'h1 { font-size: 28px; margin-bottom: 8px; }',
    '.description { color: #6b7280; font-size: 14px; margin-bottom: 24px; }',
    '.viz-container { margin: 24px 0; text-align: center; }',
    '.viz-container svg { max-width: 100%; height: auto; }',
    '.concepts { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }',
    '.concept-tag { background: #eff6ff; color: #1e40af; padding: 4px 12px; border-radius: 16px; font-size: 13px; }',
    '.relationships { margin: 16px 0; }',
    '.relationships li { font-size: 13px; color: #4b5563; margin-bottom: 4px; }',
    '.explanation { margin-top: 24px; line-height: 1.7; font-size: 15px; white-space: pre-wrap; }',
    '@media print { body { padding: 0; } }'
  ].join('\n');
  doc.head.appendChild(style);

  // Build body
  const h1 = doc.createElement('h1');
  h1.textContent = file.title;
  doc.body.appendChild(h1);

  if (file.visualization) {
    const desc = doc.createElement('p');
    desc.className = 'description';
    desc.textContent = file.visualization.description;
    doc.body.appendChild(desc);
  }

  // Clone the SVG from the main page into the print window
  const svgEl = document.querySelector('svg');
  if (svgEl) {
    const vizContainer = doc.createElement('div');
    vizContainer.className = 'viz-container';
    const clonedSvg = svgEl.cloneNode(true);
    vizContainer.appendChild(doc.adoptNode(clonedSvg));
    doc.body.appendChild(vizContainer);
  }

  if (file.visualization) {
    const conceptsDiv = doc.createElement('div');
    conceptsDiv.className = 'concepts';
    for (const c of file.visualization.metadata.concepts) {
      const tag = doc.createElement('span');
      tag.className = 'concept-tag';
      tag.textContent = c;
      conceptsDiv.appendChild(tag);
    }
    doc.body.appendChild(conceptsDiv);

    const relList = doc.createElement('ul');
    relList.className = 'relationships';
    for (const r of file.visualization.metadata.relationships) {
      const li = doc.createElement('li');
      li.textContent = r;
      relList.appendChild(li);
    }
    doc.body.appendChild(relList);
  }

  const explanation = doc.createElement('div');
  explanation.className = 'explanation';
  explanation.textContent = file.text;
  doc.body.appendChild(explanation);

  // Trigger print after a short delay to allow rendering
  setTimeout(() => printWindow.print(), 300);
}
