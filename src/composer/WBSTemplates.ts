/**
 * Work Breakdown Structure (WBS) Templates for Construction Projects
 * 
 * These templates provide standard industry WBS organizations that can be used
 * as starting points for swimlane organization in different project types.
 */

export interface WBSCategory {
  id: string;        // Internal identifier (e.g., 'site_prep')
  name: string;      // Display name (e.g., 'Site Preparation')
  description?: string; // Optional description of this category
  color?: string;    // Optional default color
}

export interface WBSTemplate {
  id: string;        // Template identifier (e.g., 'data_center')
  name: string;      // Display name (e.g., 'Data Center')
  description: string; // Brief description of this template
  projectTypes: string[];  // For matching project types when users mention them
  categories: string[];    // These will become swimlanes
}

/**
 * Collection of industry-standard Work Breakdown Structure templates
 */
export const WBS_TEMPLATES: WBSTemplate[] = [
  {
    id: "commercial_building",
    name: "Commercial Building WBS",
    description: "Work Breakdown Structure for commercial building projects",
    projectTypes: ["commercial", "office", "retail", "building", "commercial building"],
    categories: [
      "Site Preparation & Foundations",
      "Structural Systems",
      "Building Envelope",
      "Mechanical Systems",
      "Electrical Systems", 
      "Interior Construction",
      "Finishes",
      "Specialties & Equipment",
      "Site Work",
      "Commissioning & Close-out"
    ]
  },
  {
    id: "residential_building",
    name: "Residential Building WBS",
    description: "Work Breakdown Structure for residential building projects",
    projectTypes: ["residential", "housing", "homes", "apartments", "condos", "residential building"],
    categories: [
      "Site Preparation",
      "Foundation", 
      "Framing & Rough Carpentry",
      "Exterior Envelope",
      "Roofing",
      "Mechanical Systems",
      "Electrical",
      "Plumbing",
      "Interior Finishes",
      "Landscaping & Site Work"
    ]
  },
  {
    id: "industrial_facility",
    name: "Industrial Facility WBS",
    description: "Work Breakdown Structure for industrial facility projects",
    projectTypes: ["industrial", "factory", "manufacturing", "plant", "industrial facility"],
    categories: [
      "Site Development",
      "Civil Infrastructure",
      "Structural Systems",
      "Building Envelope",
      "Process Equipment Installation",
      "Mechanical Systems",
      "Electrical & Control Systems",
      "Piping & Plumbing",
      "Fire Protection",
      "Finishing & Auxiliary Systems"
    ]
  },
  {
    id: "infrastructure_project",
    name: "Infrastructure Project WBS",
    description: "Work Breakdown Structure for infrastructure projects",
    projectTypes: ["infrastructure", "road", "bridge", "tunnel", "highway", "pipeline"],
    categories: [
      "Preliminary Works",
      "Earthworks & Excavation",
      "Foundations & Substructure",
      "Primary Structural Elements",
      "Secondary Structural Elements",
      "Drainage & Utilities",
      "Surface Treatments & Finishes",
      "Traffic Systems & Signage",
      "Environmental Mitigation",
      "Testing & Commissioning"
    ]
  },
  {
    id: "healthcare_facility",
    name: "Healthcare Facility WBS",
    description: "Work Breakdown Structure for healthcare facility projects",
    projectTypes: ["healthcare", "hospital", "clinic", "medical center", "healthcare facility"],
    categories: [
      "Site Preparation",
      "Foundations & Structure",
      "Building Envelope",
      "Core & Shell",
      "Medical Systems Infrastructure",
      "Mechanical & Plumbing",
      "Electrical & Low Voltage",
      "Interior Construction",
      "Medical Equipment Integration",
      "Specialties & Finishes"
    ]
  },
  {
    id: "renewable_energy",
    name: "Renewable Energy Project WBS",
    description: "Work Breakdown Structure for renewable energy projects",
    projectTypes: ["renewable", "solar", "wind", "energy", "renewable energy"],
    categories: [
      "Site Assessment & Preparation",
      "Civil Works & Foundations",
      "Equipment Manufacturing/Procurement",
      "Equipment Installation",
      "Electrical Systems",
      "Transmission & Integration",
      "Control Systems",
      "Testing & Commissioning", 
      "Environmental Compliance",
      "Project Close-out"
    ]
  },
  {
    id: "education_facility",
    name: "Education Facility WBS",
    description: "Work Breakdown Structure for education facility projects",
    projectTypes: ["education", "school", "university", "campus", "education facility"],
    categories: [
      "Site Preparation", 
      "Building Structure",
      "Building Envelope",
      "MEP Systems",
      "Interior Construction",
      "Technology Infrastructure",
      "Specialized Learning Spaces",
      "Common Areas & Support Facilities",
      "Exterior Works",
      "FF&E Installation"
    ]
  },
  {
    id: "mixed_use_development",
    name: "Mixed-Use Development WBS",
    description: "Work Breakdown Structure for mixed-use development projects",
    projectTypes: ["mixed-use", "mixed use", "development", "mixed-use development"],
    categories: [
      "Site Development & Infrastructure",
      "Below-Grade Construction",
      "Core & Shell",
      "Residential Component",
      "Commercial Component",
      "Parking Facilities",
      "MEP Systems",
      "Vertical Transportation",
      "Common Areas & Amenities",
      "Exterior Works & Landscaping"
    ]
  },
  {
    id: "residential_construction",
    name: "Residential Construction",
    description: "Work Breakdown Structure for residential construction projects",
    projectTypes: ["residential", "home", "house", "single family", "townhouse", "residential construction"],
    categories: [
      "Foundation",
      "Framing", 
      "Roofing",
      "Windows & Doors",
      "MEP Rough-In",
      "Insulation",
      "Drywall",
      "Paint",
      "Flooring",
      "MEP Trim",
      "Landscaping"
    ]
  },
  {
    id: "tenant_improvement",
    name: "Tenant Improvement / TI",
    description: "Work Breakdown Structure for tenant improvement projects",
    projectTypes: ["tenant improvement", "ti", "fit-out", "office buildout", "retail buildout", "tenant build-out"],
    categories: [
      "Demo",
      "Framing",
      "MEP Rough-In",
      "Inspections",
      "Drywall",
      "Paint",
      "Flooring",
      "Ceiling Grid",
      "MEP Trim",
      "Punch",
      "Closeout"
    ]
  },
  {
    id: "mep_rough_in",
    name: "MEP Rough-In",
    description: "Work Breakdown Structure for MEP rough-in phase",
    projectTypes: ["mep rough", "mechanical rough", "electrical rough", "plumbing rough", "rough-in", "mep systems"],
    categories: [
      "Underground Utilities",
      "Slab Penetrations", 
      "Vertical Risers",
      "Horizontal Mains",
      "Branch Distribution",
      "Insulation",
      "Testing",
      "Inspections"
    ]
  },
  {
    id: "sitework",
    name: "Sitework",
    description: "Work Breakdown Structure for sitework and civil construction",
    projectTypes: ["sitework", "site work", "civil", "earthwork", "utilities", "site development"],
    categories: [
      "Mobilization",
      "Clearing & Grading",
      "Excavation",
      "Utilities",
      "Foundations",
      "Backfill",
      "Paving",
      "Curb & Gutter",
      "Landscaping",
      "Punch"
    ]
  },
  {
    id: "residential_construction_detailed",
    name: "Residential Construction (Detailed)",
    description: "Detailed Work Breakdown Structure for residential construction projects",
    projectTypes: ["residential detailed", "single family detailed", "custom home", "residential construction"],
    categories: [
      "Foundation",
      "Framing", 
      "Roofing",
      "Plumbing Rough",
      "Electrical Rough", 
      "HVAC Rough",
      "Insulation",
      "Drywall",
      "Interior Trim",
      "Paint",
      "Flooring",
      "Plumbing Finish",
      "Electrical Finish",
      "HVAC Finish", 
      "Cabinets & Counters",
      "Landscaping",
      "Final Clean",
      "Punch List"
    ]
  },
  {
    id: "tenant_improvement_detailed", 
    name: "Tenant Improvement (TI) - Detailed",
    description: "Detailed Work Breakdown Structure for tenant improvement projects",
    projectTypes: ["tenant improvement detailed", "ti detailed", "office fit-out", "retail fit-out", "commercial ti"],
    categories: [
      "Demo",
      "Framing",
      "MEP Rough-in",
      "Fire Protection", 
      "Insulation",
      "Drywall",
      "Tape/Mud/Paint",
      "Ceiling Grid",
      "Flooring", 
      "Millwork",
      "MEP Trim",
      "Low Voltage",
      "Punch List",
      "Final Clean"
    ]
  },
  {
    id: "mep_package",
    name: "MEP Package",
    description: "Work Breakdown Structure for comprehensive MEP packages",
    projectTypes: ["mep package", "mechanical electrical plumbing", "mep systems", "building systems"],
    categories: [
      "Underground Utilities",
      "Plumbing Rough",
      "HVAC Ductwork", 
      "Electrical Rough",
      "Fire Protection",
      "Insulation",
      "Plumbing Top-out",
      "Electrical Trim",
      "HVAC Startup",
      "Controls/BAS",
      "Testing & Commissioning"
    ]
  },
  {
    id: "sitework_civil",
    name: "Sitework/Civil",
    description: "Work Breakdown Structure for comprehensive sitework and civil construction",
    projectTypes: ["sitework civil", "civil construction", "site development", "infrastructure", "earthwork"],
    categories: [
      "Survey & Layout",
      "Clearing & Grubbing", 
      "Earthwork & Grading",
      "Utilities (Storm/Sanitary/Water)",
      "Base & Subbase",
      "Paving",
      "Curb & Gutter",
      "Sidewalks",
      "Landscaping",
      "Striping & Signage",
      "Erosion Control",
      "Final Grade"
    ]
  }
];

/**
 * Get all WBS templates
 */
export function getAllWBSTemplates(): WBSTemplate[] {
  return WBS_TEMPLATES;
}

/**
 * Get a specific WBS template by ID
 */
export function getWBSTemplate(id: string): WBSTemplate | undefined {
  return WBS_TEMPLATES.find(template => template.id === id);
}

/**
 * Get all WBS template IDs
 */
export function getWBSTemplateIds(): string[] {
  return WBS_TEMPLATES.map(template => template.id);
}

/**
 * Get all WBS template names
 */
export function getWBSTemplateNames(): string[] {
  return WBS_TEMPLATES.map(template => template.name);
}

/**
 * Find the best matching WBS template based on name/description
 */
export function findBestMatchingWBSTemplate(query: string): WBSTemplate | undefined {
  if (!query) return undefined;
  
  const lowerQuery = query.toLowerCase();
  
  // First try exact match on ID
  const exactIDMatch = WBS_TEMPLATES.find(template => 
    template.id.toLowerCase() === lowerQuery
  );
  if (exactIDMatch) return exactIDMatch;
  
  // Then try exact match on name
  const exactNameMatch = WBS_TEMPLATES.find(template => 
    template.name.toLowerCase() === lowerQuery
  );
  if (exactNameMatch) return exactNameMatch;
  
  // Then try to find by project type
  const projectTypeMatch = WBS_TEMPLATES.find(template => 
    template.projectTypes.some(type => lowerQuery.includes(type))
  );
  if (projectTypeMatch) return projectTypeMatch;
  
  // Finally, check for partial matches in name or description
  const partialMatch = WBS_TEMPLATES.find(template => 
    template.name.toLowerCase().includes(lowerQuery) || 
    template.description.toLowerCase().includes(lowerQuery)
  );
  
  return partialMatch;
} 