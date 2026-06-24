// Helper to parse KML files on the client side using DOMParser
export interface ParsedKMLAsset {
  name: string;
  description: string;
  type: 'Point' | 'LineString' | 'Polygon';
  coordinates: any; // {lat, lng} or Array of {lat, lng}
  properties: {
    color?: string;
    fillColor?: string;
    strokeWidth?: number;
    fillOpacity?: number;
  };
}

// Convert KML color format (aabbggrr) to standard CSS hex format (#rrggbb)
function parseKmlColor(kmlColor: string | null): { hex: string; opacity: number } {
  if (!kmlColor) return { hex: '#4285F4', opacity: 1 };
  
  // Clean up whitespace
  const cleanColor = kmlColor.trim();
  if (cleanColor.length !== 8) {
    return { hex: '#4285F4', opacity: 1 };
  }

  // KML format is aabbggrr
  const a = cleanColor.substring(0, 2);
  const b = cleanColor.substring(2, 4);
  const g = cleanColor.substring(4, 6);
  const r = cleanColor.substring(6, 8);

  // Convert alpha to opacity
  const opacity = parseInt(a, 16) / 255;
  const hex = `#${r}${g}${b}`;

  return { hex, opacity: parseFloat(opacity.toFixed(2)) };
}

// Parses coordinates string "lng,lat,alt lng,lat,alt ..." into [{lat, lng}, ...]
function parseCoordinatesString(coordStr: string): { lat: number; lng: number }[] {
  const points = coordStr.trim().split(/\s+/);
  return points
    .map((p) => {
      const parts = p.split(',');
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (isNaN(lat) || isNaN(lng)) return null;
      return { lat, lng };
    })
    .filter((p): p is { lat: number; lng: number } => p !== null);
}

// Tolerant XML node fetchers to handle case variations (e.g. coordinates vs Coordinates, Placemark vs placemark)
function getNodesByTagNameTolerant(element: Element | Document, tagName: string): Element[] {
  const lowercase = tagName.toLowerCase();
  const titlecase = tagName.charAt(0).toUpperCase() + tagName.slice(1);
  const uppercase = tagName.toUpperCase();
  
  const res1 = element.getElementsByTagName(lowercase);
  if (res1 && res1.length > 0) return Array.from(res1);
  
  const res2 = element.getElementsByTagName(titlecase);
  if (res2 && res2.length > 0) return Array.from(res2);
  
  const res3 = element.getElementsByTagName(uppercase);
  if (res3 && res3.length > 0) return Array.from(res3);
  
  return [];
}

function getFirstNodeByTagNameTolerant(element: Element | Document, tagName: string): Element | null {
  const nodes = getNodesByTagNameTolerant(element, tagName);
  return nodes.length > 0 ? nodes[0] : null;
}

export function parseKML(kmlText: string): ParsedKMLAsset[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
  const placemarks = getNodesByTagNameTolerant(xmlDoc, 'Placemark');
  const results: ParsedKMLAsset[] = [];

  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    
    // 1. Extract Name & Description
    const nameNode = getFirstNodeByTagNameTolerant(placemark, 'name');
    const name = nameNode ? nameNode.textContent || 'Unnamed Placemark' : 'Unnamed Placemark';
    
    const descNode = getFirstNodeByTagNameTolerant(placemark, 'description');
    const description = descNode ? descNode.textContent || '' : '';

    // 2. Parse styles
    let color = '#4285F4';
    let fillColor = '#4285F4';
    let fillOpacity = 0.3;
    let strokeWidth = 3;

    const styleNode = getFirstNodeByTagNameTolerant(placemark, 'Style') || getFirstNodeByTagNameTolerant(xmlDoc, 'Style');
    if (styleNode) {
      const lineStyle = getFirstNodeByTagNameTolerant(styleNode, 'LineStyle');
      if (lineStyle) {
        const colorNode = getFirstNodeByTagNameTolerant(lineStyle, 'color');
        if (colorNode) {
          const parsed = parseKmlColor(colorNode.textContent);
          color = parsed.hex;
        }
        const widthNode = getFirstNodeByTagNameTolerant(lineStyle, 'width');
        if (widthNode) {
          strokeWidth = parseFloat(widthNode.textContent || '3');
        }
      }
      
      const polyStyle = getFirstNodeByTagNameTolerant(styleNode, 'PolyStyle');
      if (polyStyle) {
        const colorNode = getFirstNodeByTagNameTolerant(polyStyle, 'color');
        if (colorNode) {
          const parsed = parseKmlColor(colorNode.textContent);
          fillColor = parsed.hex;
          fillOpacity = parsed.opacity;
        }
      }
    }

    const properties = {
      color,
      fillColor,
      strokeWidth,
      fillOpacity,
    };

    // 3. Extract Geometries
    const pointNode = getFirstNodeByTagNameTolerant(placemark, 'Point');
    const lineNode = getFirstNodeByTagNameTolerant(placemark, 'LineString');
    const polyNode = getFirstNodeByTagNameTolerant(placemark, 'Polygon');

    if (pointNode) {
      const coordNode = getFirstNodeByTagNameTolerant(pointNode, 'coordinates');
      if (coordNode && coordNode.textContent) {
        const coords = parseCoordinatesString(coordNode.textContent);
        if (coords.length > 0) {
          results.push({
            name,
            description,
            type: 'Point',
            coordinates: coords[0],
            properties,
          });
        }
      }
    } else if (lineNode) {
      const coordNode = getFirstNodeByTagNameTolerant(lineNode, 'coordinates');
      if (coordNode && coordNode.textContent) {
        const coords = parseCoordinatesString(coordNode.textContent);
        if (coords.length >= 2) {
          results.push({
            name,
            description,
            type: 'LineString',
            coordinates: coords,
            properties,
          });
        }
      }
    } else if (polyNode) {
      // Look in outerBoundaryIs
      const outerBoundary = getFirstNodeByTagNameTolerant(polyNode, 'outerBoundaryIs');
      if (outerBoundary) {
        const coordNode = getFirstNodeByTagNameTolerant(outerBoundary, 'coordinates');
        if (coordNode && coordNode.textContent) {
          const coords = parseCoordinatesString(coordNode.textContent);
          if (coords.length >= 3) {
            results.push({
              name,
              description,
              type: 'Polygon',
              coordinates: coords,
              properties,
            });
          }
        }
      }
    }
  }

  return results;
}

// Export single asset or list of assets as KML text
export function exportToKML(assetsList: any[]): string {
  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>GeoData Export</name>
    <description>Exported assets from GeoData Manager</description>
`;

  assetsList.forEach((asset) => {
    const strokeColorKml = convertHexToKmlColor(asset.properties?.color || '#4285F4', 1);
    const fillColorKml = convertHexToKmlColor(asset.properties?.fillColor || '#4285F4', asset.properties?.fillOpacity || 0.3);
    const width = asset.properties?.strokeWidth || 3;

    kml += `    <Style id="style_${asset.id}">
      <LineStyle>
        <color>${strokeColorKml}</color>
        <width>${width}</width>
      </LineStyle>
      <PolyStyle>
        <color>${fillColorKml}</color>
      </PolyStyle>
    </Style>
    <Placemark>
      <name>${escapeXml(asset.name)}</name>
      <description>${escapeXml(asset.description || '')}</description>
      <styleUrl>#style_${asset.id}</styleUrl>
`;

    if (asset.type === 'Point') {
      kml += `      <Point>
        <coordinates>${asset.coordinates.lng},${asset.coordinates.lat}</coordinates>
      </Point>
`;
    } else if (asset.type === 'LineString') {
      const coordStr = asset.coordinates.map((c: any) => `${c.lng},${c.lat}`).join(' ');
      kml += `      <LineString>
        <coordinates>${coordStr}</coordinates>
      </LineString>
`;
    } else if (asset.type === 'Polygon') {
      const temp = [...asset.coordinates];
      // Close polygon if not closed
      if (temp.length > 0) {
        const first = temp[0];
        const last = temp[temp.length - 1];
        if (first.lat !== last.lat || first.lng !== last.lng) {
          temp.push(first);
        }
      }
      const coordStr = temp.map((c: any) => `${c.lng},${c.lat}`).join(' ');
      kml += `      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordStr}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
`;
    }

    kml += `    </Placemark>\n`;
  });

  kml += `  </Document>
</kml>`;

  return kml;
}

// Convert standard #rrggbb hex color to aabbggrr format for KML
function convertHexToKmlColor(hex: string, opacity: number): string {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  if (cleanHex.length !== 6) {
    cleanHex = 'f48542'; // default blue-ish
  }

  // hex is rrggbb, we need bbggrr
  const r = cleanHex.substring(0, 2);
  const g = cleanHex.substring(2, 4);
  const b = cleanHex.substring(4, 6);

  // Convert opacity (0 to 1) to hex alpha (00 to ff)
  const aVal = Math.round(opacity * 255);
  const aHex = aVal.toString(16).padStart(2, '0');

  return `${aHex}${b}${g}${r}`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
