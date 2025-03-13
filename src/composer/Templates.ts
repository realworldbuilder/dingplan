/**
 * Task template in a construction sequence
 */
export interface TaskTemplate {
  name: string;
  duration: number;
  tradeId: string;
  crewSize: number;
  dependsOnPrevious: boolean;
}

/**
 * Construction sequence template
 */
export interface SequenceTemplate {
  name: string;
  description: string;
  aliases?: string[];  // Alternative names to match against
  tasks: TaskTemplate[];
}

/**
 * Library of predefined construction sequence templates for commercial construction
 */
export const TEMPLATES: Record<string, SequenceTemplate> = {
  // Commercial foundation template
  foundation: {
    name: "Foundation Sequence",
    description: "Foundation work sequence for commercial construction",
    aliases: ["foundations", "footings", "concrete foundation", "commercial foundation", "slab"],
    tasks: [
      { name: "Site Preparation", duration: 2, tradeId: "demolition", crewSize: 4, dependsOnPrevious: false },
      { name: "Excavation", duration: 3, tradeId: "concrete", crewSize: 5, dependsOnPrevious: true },
      { name: "Underground Utilities", duration: 3, tradeId: "plumbing", crewSize: 4, dependsOnPrevious: true },
      { name: "Formwork", duration: 4, tradeId: "concrete", crewSize: 6, dependsOnPrevious: true },
      { name: "Reinforcement", duration: 3, tradeId: "concrete", crewSize: 5, dependsOnPrevious: true },
      { name: "Concrete Pour", duration: 2, tradeId: "concrete", crewSize: 8, dependsOnPrevious: true },
      { name: "Curing", duration: 7, tradeId: "concrete", crewSize: 1, dependsOnPrevious: true },
      { name: "Waterproofing", duration: 3, tradeId: "concrete", crewSize: 4, dependsOnPrevious: true }
    ]
  },
  
  // New template keys with clearer names
  steel_structure: {
    name: "Steel Structure Sequence",
    description: "Steel structural work sequence for commercial construction",
    aliases: ["steel", "structural steel", "structural framing", "steel frame", "commercial structure", "steelstructure"],
    tasks: [
      { name: "Layout and Surveying", duration: 2, tradeId: "management", crewSize: 3, dependsOnPrevious: false },
      { name: "Column Installation", duration: 5, tradeId: "framing", crewSize: 8, dependsOnPrevious: true },
      { name: "Beam Installation", duration: 4, tradeId: "framing", crewSize: 8, dependsOnPrevious: true },
      { name: "Decking Installation", duration: 3, tradeId: "framing", crewSize: 6, dependsOnPrevious: true },
      { name: "Stair Installation", duration: 2, tradeId: "framing", crewSize: 4, dependsOnPrevious: false },
      { name: "Welding and Connections", duration: 4, tradeId: "framing", crewSize: 6, dependsOnPrevious: true },
      { name: "Fireproofing", duration: 3, tradeId: "fireproofing", crewSize: 5, dependsOnPrevious: true },
      { name: "Quality Inspection", duration: 2, tradeId: "management", crewSize: 2, dependsOnPrevious: true }
    ]
  },
  
  mep_systems: {
    name: "MEP Systems Sequence",
    description: "Mechanical, Electrical, and Plumbing work sequence",
    aliases: ["mep", "mechanical electrical", "services", "building services", "commercial mep", "mepzone"],
    tasks: [
      { name: "Coordination Modeling", duration: 5, tradeId: "management", crewSize: 3, dependsOnPrevious: false },
      { name: "HVAC Ductwork", duration: 7, tradeId: "hvac", crewSize: 6, dependsOnPrevious: true },
      { name: "Piping Systems", duration: 6, tradeId: "plumbing", crewSize: 5, dependsOnPrevious: false },
      { name: "Equipment Setting", duration: 3, tradeId: "hvac", crewSize: 4, dependsOnPrevious: true },
      { name: "Electrical Conduit", duration: 5, tradeId: "electrical", crewSize: 6, dependsOnPrevious: false },
      { name: "Cable Trays", duration: 4, tradeId: "electrical", crewSize: 4, dependsOnPrevious: true },
      { name: "Fire Protection", duration: 5, tradeId: "fireproofing", crewSize: 5, dependsOnPrevious: false },
      { name: "Controls and BMS", duration: 4, tradeId: "electrical", crewSize: 3, dependsOnPrevious: true },
      { name: "Testing and Balancing", duration: 3, tradeId: "hvac", crewSize: 2, dependsOnPrevious: true }
    ]
  },
  
  interior_fitout: {
    name: "Interior Fitout Sequence",
    description: "Interior work sequence for commercial construction",
    aliases: ["interior", "fitout", "finish", "tenant improvement", "ti", "commercial interior", "interiorzone"],
    tasks: [
      { name: "Framing", duration: 4, tradeId: "framing", crewSize: 6, dependsOnPrevious: false },
      { name: "In-Wall Utilities", duration: 5, tradeId: "electrical", crewSize: 5, dependsOnPrevious: true },
      { name: "Drywall Installation", duration: 5, tradeId: "drywall", crewSize: 8, dependsOnPrevious: true },
      { name: "Taping and Finishing", duration: 4, tradeId: "drywall", crewSize: 6, dependsOnPrevious: true },
      { name: "Ceiling Grid", duration: 3, tradeId: "carpentry", crewSize: 4, dependsOnPrevious: true },
      { name: "Flooring", duration: 4, tradeId: "flooring", crewSize: 5, dependsOnPrevious: false },
      { name: "Painting", duration: 4, tradeId: "painting", crewSize: 6, dependsOnPrevious: true },
      { name: "Doors and Hardware", duration: 2, tradeId: "carpentry", crewSize: 3, dependsOnPrevious: false },
      { name: "Fixtures and Trim", duration: 3, tradeId: "carpentry", crewSize: 4, dependsOnPrevious: true }
    ]
  },
  
  data_center: {
    name: "Data Center Sequence",
    description: "Specialized work sequence for data center construction",
    aliases: ["datacenter", "server room", "it room", "computer room", "data hall", "datacenterzone"],
    tasks: [
      { name: "Raised Floor System", duration: 4, tradeId: "flooring", crewSize: 5, dependsOnPrevious: false },
      { name: "Power Distribution", duration: 6, tradeId: "electrical", crewSize: 8, dependsOnPrevious: true },
      { name: "Precision Cooling", duration: 5, tradeId: "hvac", crewSize: 6, dependsOnPrevious: false },
      { name: "Fire Suppression", duration: 4, tradeId: "fireproofing", crewSize: 4, dependsOnPrevious: false },
      { name: "Cable Management", duration: 5, tradeId: "electrical", crewSize: 6, dependsOnPrevious: true },
      { name: "Security Systems", duration: 3, tradeId: "electrical", crewSize: 3, dependsOnPrevious: false },
      { name: "Server Rack Installation", duration: 4, tradeId: "electrical", crewSize: 5, dependsOnPrevious: true },
      { name: "Testing and Commissioning", duration: 5, tradeId: "management", crewSize: 4, dependsOnPrevious: true }
    ]
  },
  
  building_envelope: {
    name: "Building Envelope Sequence",
    description: "Exterior envelope work sequence for a commercial building",
    aliases: ["facade", "exterior", "curtain wall", "envelope", "skin", "cladding", "facadezone"],
    tasks: [
      { name: "Anchor Layout", duration: 3, tradeId: "framing", crewSize: 4, dependsOnPrevious: false },
      { name: "Curtain Wall Framing", duration: 5, tradeId: "framing", crewSize: 6, dependsOnPrevious: true },
      { name: "Glazing Installation", duration: 6, tradeId: "glazing", crewSize: 6, dependsOnPrevious: true },
      { name: "Metal Panel Installation", duration: 5, tradeId: "framing", crewSize: 5, dependsOnPrevious: false },
      { name: "Sealants and Flashings", duration: 4, tradeId: "roofing", crewSize: 4, dependsOnPrevious: true },
      { name: "Entrance Systems", duration: 3, tradeId: "glazing", crewSize: 4, dependsOnPrevious: false },
      { name: "Weather Barrier", duration: 2, tradeId: "roofing", crewSize: 3, dependsOnPrevious: false },
      { name: "Testing and Inspection", duration: 2, tradeId: "management", crewSize: 2, dependsOnPrevious: true }
    ]
  },
  
  // Institutional Building Template
  institutionalbuilding: {
    name: "Institutional Building",
    description: "Template for schools, healthcare facilities, and government buildings",
    aliases: ["school", "hospital", "government building", "institutional", "healthcare", "education"],
    tasks: [
      { name: "Site Clearing & Mobilization", duration: 5, tradeId: "demolition", crewSize: 6, dependsOnPrevious: false },
      { name: "Structural Foundations & Slabs", duration: 12, tradeId: "concrete", crewSize: 8, dependsOnPrevious: true },
      { name: "Structural Framing", duration: 15, tradeId: "framing", crewSize: 10, dependsOnPrevious: true },
      { name: "Building Envelope", duration: 18, tradeId: "roofing", crewSize: 8, dependsOnPrevious: true },
      { name: "MEP Rough-in", duration: 20, tradeId: "electrical", crewSize: 12, dependsOnPrevious: true },
      { name: "Interior Framing & Wall Assemblies", duration: 15, tradeId: "drywall", crewSize: 10, dependsOnPrevious: true },
      { name: "Interior Finishes & Painting", duration: 12, tradeId: "painting", crewSize: 8, dependsOnPrevious: true },
      { name: "Specialty Installations", duration: 10, tradeId: "finishing", crewSize: 6, dependsOnPrevious: true },
      { name: "Exterior Improvements & Landscaping", duration: 8, tradeId: "finishing", crewSize: 5, dependsOnPrevious: false },
      { name: "Final Inspections & Punch List", duration: 5, tradeId: "finishing", crewSize: 4, dependsOnPrevious: true }
    ]
  },
  
  // Industrial building components - broken into individual templates
  industrial_siteprep: {
    name: "Industrial Site Preparation",
    description: "Site preparation and grading for industrial buildings",
    aliases: ["industrial site prep", "site grading", "industrial grading", "site work industrial", "warehouse site prep"],
    tasks: [
      { name: "Mobilization", duration: 1, tradeId: "demolition", crewSize: 3, dependsOnPrevious: false },
      { name: "Clearing Vegetation", duration: 2, tradeId: "demolition", crewSize: 4, dependsOnPrevious: true },
      { name: "Rough Grading", duration: 3, tradeId: "demolition", crewSize: 5, dependsOnPrevious: true },
      { name: "Erosion Control", duration: 1, tradeId: "demolition", crewSize: 3, dependsOnPrevious: false }
    ]
  },
  
  industrial_foundation: {
    name: "Industrial Foundation Work",
    description: "Heavy foundation work and concrete slabs for industrial projects",
    aliases: ["heavy foundation", "industrial slab", "warehouse foundation", "factory foundation", "industrial concrete"],
    tasks: [
      { name: "Layout & Engineering", duration: 2, tradeId: "concrete", crewSize: 3, dependsOnPrevious: false },
      { name: "Excavation", duration: 3, tradeId: "concrete", crewSize: 6, dependsOnPrevious: true },
      { name: "Formwork Installation", duration: 4, tradeId: "concrete", crewSize: 8, dependsOnPrevious: true },
      { name: "Reinforcement", duration: 3, tradeId: "concrete", crewSize: 6, dependsOnPrevious: true },
      { name: "Concrete Pouring", duration: 2, tradeId: "concrete", crewSize: 10, dependsOnPrevious: true },
      { name: "Curing Process", duration: 5, tradeId: "concrete", crewSize: 1, dependsOnPrevious: true }
    ]
  },
  
  industrial_steel: {
    name: "Industrial Steel Erection",
    description: "Structural steel erection for industrial buildings",
    aliases: ["structural steel", "industrial framing", "warehouse steel", "metal building", "industrial structure"],
    tasks: [
      { name: "Column Layout", duration: 2, tradeId: "framing", crewSize: 4, dependsOnPrevious: false },
      { name: "Column Erection", duration: 4, tradeId: "framing", crewSize: 8, dependsOnPrevious: true },
      { name: "Beam Installation", duration: 4, tradeId: "framing", crewSize: 8, dependsOnPrevious: true },
      { name: "Bracing Installation", duration: 3, tradeId: "framing", crewSize: 6, dependsOnPrevious: true },
      { name: "Connections & Welding", duration: 5, tradeId: "framing", crewSize: 6, dependsOnPrevious: true }
    ]
  },
  
  industrial_envelope: {
    name: "Industrial Building Envelope",
    description: "Exterior wall panels and roofing systems for industrial buildings",
    aliases: ["industrial walls", "warehouse roof", "metal panels", "industrial facade", "building shell"],
    tasks: [
      { name: "Wall Panel Layout", duration: 2, tradeId: "framing", crewSize: 4, dependsOnPrevious: false },
      { name: "Wall Panel Installation", duration: 4, tradeId: "framing", crewSize: 6, dependsOnPrevious: true },
      { name: "Roof Deck Installation", duration: 3, tradeId: "roofing", crewSize: 5, dependsOnPrevious: false },
      { name: "Roofing Membrane", duration: 3, tradeId: "roofing", crewSize: 6, dependsOnPrevious: true },
      { name: "Flashing & Details", duration: 2, tradeId: "roofing", crewSize: 4, dependsOnPrevious: true }
    ]
  },
  
  industrial_mep: {
    name: "Industrial MEP Rough-in",
    description: "Large-scale mechanical, electrical, plumbing infrastructure for industrial buildings",
    aliases: ["industrial mechanical", "warehouse electrical", "factory plumbing", "industrial services"],
    tasks: [
      { name: "MEP Coordination", duration: 2, tradeId: "management", crewSize: 3, dependsOnPrevious: false },
      { name: "Main Electrical Service", duration: 4, tradeId: "electrical", crewSize: 6, dependsOnPrevious: true },
      { name: "Ductwork Installation", duration: 5, tradeId: "hvac", crewSize: 8, dependsOnPrevious: false },
      { name: "Plumbing Rough-in", duration: 4, tradeId: "plumbing", crewSize: 6, dependsOnPrevious: false },
      { name: "Equipment Setting", duration: 3, tradeId: "hvac", crewSize: 5, dependsOnPrevious: true },
      { name: "Branch Electrical", duration: 4, tradeId: "electrical", crewSize: 6, dependsOnPrevious: true }
    ]
  },
  
  industrial_equipment: {
    name: "Industrial Systems Installation",
    description: "Specialty equipment and industrial systems installation",
    aliases: ["industrial equipment", "specialty systems", "manufacturing equipment", "process equipment"],
    tasks: [
      { name: "Equipment Delivery", duration: 1, tradeId: "management", crewSize: 2, dependsOnPrevious: false },
      { name: "Equipment Setting", duration: 3, tradeId: "hvac", crewSize: 6, dependsOnPrevious: true },
      { name: "Equipment Connections", duration: 4, tradeId: "electrical", crewSize: 5, dependsOnPrevious: true },
      { name: "System Testing", duration: 2, tradeId: "hvac", crewSize: 3, dependsOnPrevious: true },
      { name: "System Balancing", duration: 2, tradeId: "hvac", crewSize: 3, dependsOnPrevious: true }
    ]
  },
  
  industrial_interior: {
    name: "Industrial Interior Spaces",
    description: "Interior partitions and office spaces in industrial buildings",
    aliases: ["warehouse offices", "industrial partitions", "factory interiors", "office build-out"],
    tasks: [
      { name: "Framing Layout", duration: 1, tradeId: "framing", crewSize: 3, dependsOnPrevious: false },
      { name: "Interior Framing", duration: 3, tradeId: "framing", crewSize: 6, dependsOnPrevious: true },
      { name: "In-Wall MEP", duration: 3, tradeId: "electrical", crewSize: 4, dependsOnPrevious: true },
      { name: "Drywall Installation", duration: 3, tradeId: "drywall", crewSize: 5, dependsOnPrevious: true },
      { name: "Interior Finishes", duration: 4, tradeId: "painting", crewSize: 5, dependsOnPrevious: true }
    ]
  },
  
  industrial_safety: {
    name: "Safety & Security Systems",
    description: "Safety and security systems installation for industrial facilities",
    aliases: ["fire alarm", "security system", "access control", "industrial safety"],
    tasks: [
      { name: "System Layout", duration: 1, tradeId: "electrical", crewSize: 2, dependsOnPrevious: false },
      { name: "Fire Alarm Rough-in", duration: 3, tradeId: "electrical", crewSize: 4, dependsOnPrevious: true },
      { name: "Security Rough-in", duration: 3, tradeId: "electrical", crewSize: 4, dependsOnPrevious: false },
      { name: "Device Installation", duration: 2, tradeId: "electrical", crewSize: 3, dependsOnPrevious: true },
      { name: "System Programming", duration: 2, tradeId: "electrical", crewSize: 2, dependsOnPrevious: true }
    ]
  },
  
  industrial_utilities: {
    name: "Industrial External Utilities",
    description: "Exterior infrastructure and utility connections for industrial buildings",
    aliases: ["utility connections", "site utilities", "external infrastructure", "service connections"],
    tasks: [
      { name: "Utility Coordination", duration: 2, tradeId: "management", crewSize: 2, dependsOnPrevious: false },
      { name: "Water Service", duration: 3, tradeId: "plumbing", crewSize: 5, dependsOnPrevious: true },
      { name: "Electrical Service", duration: 3, tradeId: "electrical", crewSize: 5, dependsOnPrevious: false },
      { name: "Gas Service", duration: 2, tradeId: "plumbing", crewSize: 4, dependsOnPrevious: false },
      { name: "Site Drainage", duration: 4, tradeId: "concrete", crewSize: 6, dependsOnPrevious: false }
    ]
  },
  
  industrial_commissioning: {
    name: "Industrial Commissioning",
    description: "Inspections, commissioning and punch list for industrial buildings",
    aliases: ["final inspection", "industrial punch list", "building commissioning", "project completion"],
    tasks: [
      { name: "Pre-inspections", duration: 2, tradeId: "management", crewSize: 2, dependsOnPrevious: false },
      { name: "Punch List Creation", duration: 1, tradeId: "management", crewSize: 2, dependsOnPrevious: true },
      { name: "Punch List Work", duration: 3, tradeId: "finishing", crewSize: 6, dependsOnPrevious: true },
      { name: "Final Inspections", duration: 1, tradeId: "management", crewSize: 2, dependsOnPrevious: true },
      { name: "Owner Training", duration: 1, tradeId: "management", crewSize: 2, dependsOnPrevious: true }
    ]
  },
  
  // Specialized structure components - broken into individual templates
  specialized_siteclearing: {
    name: "Specialized Site Clearing",
    description: "Site clearing and excavation for specialized structures",
    aliases: ["stadium site work", "arena clearing", "sports facility site", "parking garage site"],
    tasks: [
      { name: "Site Survey", duration: 1, tradeId: "management", crewSize: 3, dependsOnPrevious: false },
      { name: "Demolition", duration: 3, tradeId: "demolition", crewSize: 6, dependsOnPrevious: true },
      { name: "Mass Excavation", duration: 4, tradeId: "demolition", crewSize: 8, dependsOnPrevious: true },
      { name: "Site Protection", duration: 1, tradeId: "demolition", crewSize: 4, dependsOnPrevious: true }
    ]
  },
  
  specialized_foundations: {
    name: "Specialized Deep Foundations",
    description: "Deep foundations and structural piles for specialized structures",
    aliases: ["deep foundation", "structural piles", "caissons", "drilled piers", "foundation system"],
    tasks: [
      { name: "Engineering Layout", duration: 2, tradeId: "management", crewSize: 3, dependsOnPrevious: false },
      { name: "Pile Installation", duration: 5, tradeId: "concrete", crewSize: 8, dependsOnPrevious: true },
      { name: "Pile Caps", duration: 3, tradeId: "concrete", crewSize: 6, dependsOnPrevious: true },
      { name: "Grade Beams", duration: 4, tradeId: "concrete", crewSize: 6, dependsOnPrevious: true }
    ]
  },
  
  specialized_structure: {
    name: "Specialized Structural Work",
    description: "Structural concrete and steel erection for specialized structures",
    aliases: ["stadium structure", "arena frame", "complex structural", "large span structure"],
    tasks: [
      { name: "Formwork", duration: 5, tradeId: "concrete", crewSize: 8, dependsOnPrevious: false },
      { name: "Reinforcement", duration: 4, tradeId: "concrete", crewSize: 6, dependsOnPrevious: true },
      { name: "Concrete Placement", duration: 3, tradeId: "concrete", crewSize: 10, dependsOnPrevious: true },
      { name: "Steel Erection", duration: 6, tradeId: "framing", crewSize: 10, dependsOnPrevious: false },
      { name: "Connections", duration: 4, tradeId: "framing", crewSize: 8, dependsOnPrevious: true }
    ]
  },
  
  specialized_facade: {
    name: "Specialized Facade Work",
    description: "Facade and exterior finishes for specialized structures",
    aliases: ["stadium facade", "arena exterior", "complex cladding", "architectural facade"],
    tasks: [
      { name: "Facade Layout", duration: 2, tradeId: "framing", crewSize: 4, dependsOnPrevious: false },
      { name: "Support System", duration: 4, tradeId: "framing", crewSize: 6, dependsOnPrevious: true },
      { name: "Panel Installation", duration: 5, tradeId: "framing", crewSize: 8, dependsOnPrevious: true },
      { name: "Glazing Installation", duration: 4, tradeId: "glazing", crewSize: 6, dependsOnPrevious: true },
      { name: "Weatherproofing", duration: 3, tradeId: "roofing", crewSize: 5, dependsOnPrevious: true }
    ]
  },
  
  specialized_mep: {
    name: "Specialized MEP Systems",
    description: "Infrastructure MEP systems rough-in for specialized structures",
    aliases: ["stadium MEP", "arena utilities", "complex mechanical", "high-capacity MEP"],
    tasks: [
      { name: "MEP Coordination", duration: 2, tradeId: "management", crewSize: 3, dependsOnPrevious: false },
      { name: "Main Distribution", duration: 4, tradeId: "electrical", crewSize: 8, dependsOnPrevious: true },
      { name: "Vertical Risers", duration: 5, tradeId: "plumbing", crewSize: 6, dependsOnPrevious: true },
      { name: "HVAC Mains", duration: 5, tradeId: "hvac", crewSize: 8, dependsOnPrevious: false },
      { name: "Zone Distribution", duration: 4, tradeId: "electrical", crewSize: 6, dependsOnPrevious: true }
    ]
  },
  
  specialized_systems: {
    name: "Specialized Systems Installation",
    description: "Specialized lighting, communication, and security systems",
    aliases: ["stadium lighting", "arena systems", "event systems", "specialized electrical"],
    tasks: [
      { name: "System Design", duration: 2, tradeId: "management", crewSize: 3, dependsOnPrevious: false },
      { name: "Specialty Lighting", duration: 4, tradeId: "electrical", crewSize: 6, dependsOnPrevious: true },
      { name: "Audio/Video Systems", duration: 4, tradeId: "electrical", crewSize: 5, dependsOnPrevious: true },
      { name: "Security Systems", duration: 3, tradeId: "electrical", crewSize: 4, dependsOnPrevious: false },
      { name: "Control Integration", duration: 3, tradeId: "electrical", crewSize: 3, dependsOnPrevious: true }
    ]
  },
  
  specialized_interiors: {
    name: "Specialized Interior Finishes",
    description: "Interior finishes and seating for stadiums/arenas",
    aliases: ["stadium seating", "arena interiors", "spectator areas", "interior finishes"],
    tasks: [
      { name: "Architectural Finishes", duration: 4, tradeId: "finishing", crewSize: 6, dependsOnPrevious: false },
      { name: "Flooring Installation", duration: 3, tradeId: "flooring", crewSize: 6, dependsOnPrevious: true },
      { name: "Fixed Seating", duration: 5, tradeId: "carpentry", crewSize: 8, dependsOnPrevious: true },
      { name: "Signage & Wayfinding", duration: 2, tradeId: "finishing", crewSize: 4, dependsOnPrevious: false },
      { name: "Final Finishes", duration: 3, tradeId: "painting", crewSize: 6, dependsOnPrevious: true }
    ]
  },
  
  specialized_access: {
    name: "Specialized Access Systems",
    description: "Access systems and elevators for specialized structures",
    aliases: ["stadium elevators", "arena access", "vertical transportation", "escalators"],
    tasks: [
      { name: "Elevator Installation", duration: 4, tradeId: "finishing", crewSize: 4, dependsOnPrevious: false },
      { name: "Escalator Installation", duration: 4, tradeId: "finishing", crewSize: 4, dependsOnPrevious: false },
      { name: "Stair Finishes", duration: 3, tradeId: "carpentry", crewSize: 5, dependsOnPrevious: false },
      { name: "Accessibility Features", duration: 2, tradeId: "finishing", crewSize: 3, dependsOnPrevious: true },
      { name: "Testing & Certification", duration: 1, tradeId: "management", crewSize: 2, dependsOnPrevious: true }
    ]
  },
  
  specialized_sitework: {
    name: "Specialized Site Improvements",
    description: "Landscaping, pavement, and site improvements for specialized structures",
    aliases: ["stadium landscaping", "arena paving", "sports facility site", "exterior improvements"],
    tasks: [
      { name: "Site Paving", duration: 5, tradeId: "concrete", crewSize: 8, dependsOnPrevious: false },
      { name: "Hardscape Features", duration: 4, tradeId: "concrete", crewSize: 6, dependsOnPrevious: true },
      { name: "Landscape Planting", duration: 3, tradeId: "finishing", crewSize: 5, dependsOnPrevious: false },
      { name: "Site Lighting", duration: 3, tradeId: "electrical", crewSize: 4, dependsOnPrevious: false },
      { name: "Site Furnishings", duration: 2, tradeId: "finishing", crewSize: 4, dependsOnPrevious: true }
    ]
  },
  
  specialized_completion: {
    name: "Specialized Structure Completion",
    description: "Final inspections, commissioning, and completion for specialized structures",
    aliases: ["stadium completion", "arena commissioning", "final inspections", "project closeout"],
    tasks: [
      { name: "Systems Testing", duration: 3, tradeId: "management", crewSize: 4, dependsOnPrevious: false },
      { name: "Fire & Life Safety", duration: 2, tradeId: "management", crewSize: 3, dependsOnPrevious: true },
      { name: "Punch List Work", duration: 4, tradeId: "finishing", crewSize: 8, dependsOnPrevious: true },
      { name: "Regulatory Inspections", duration: 2, tradeId: "management", crewSize: 2, dependsOnPrevious: true },
      { name: "Occupancy Certification", duration: 1, tradeId: "management", crewSize: 2, dependsOnPrevious: true }
    ]
  },
  
  // The following are provided for backward compatibility with old template keys
  steelstructure: { 
    name: "Steel Structure Sequence",
    description: "Steel structural work sequence for commercial construction",
    aliases: ["steel", "structural steel", "structural framing", "steel frame", "commercial structure", "steel_structure"],
    tasks: [
      { name: "Layout and Surveying", duration: 2, tradeId: "management", crewSize: 3, dependsOnPrevious: false },
      { name: "Column Installation", duration: 5, tradeId: "framing", crewSize: 8, dependsOnPrevious: true },
      { name: "Beam Installation", duration: 4, tradeId: "framing", crewSize: 8, dependsOnPrevious: true },
      { name: "Decking Installation", duration: 3, tradeId: "framing", crewSize: 6, dependsOnPrevious: true },
      { name: "Stair Installation", duration: 2, tradeId: "framing", crewSize: 4, dependsOnPrevious: false },
      { name: "Welding and Connections", duration: 4, tradeId: "framing", crewSize: 6, dependsOnPrevious: true },
      { name: "Fireproofing", duration: 3, tradeId: "fireproofing", crewSize: 5, dependsOnPrevious: true },
      { name: "Quality Inspection", duration: 2, tradeId: "management", crewSize: 2, dependsOnPrevious: true }
    ]
  },
  
  mepzone: {
    name: "MEP Systems Sequence",
    description: "Mechanical, Electrical, and Plumbing work sequence",
    aliases: ["mep", "mechanical electrical", "services", "building services", "commercial mep", "mep_systems"],
    tasks: [
      { name: "Coordination Modeling", duration: 5, tradeId: "management", crewSize: 3, dependsOnPrevious: false },
      { name: "HVAC Ductwork", duration: 7, tradeId: "hvac", crewSize: 6, dependsOnPrevious: true },
      { name: "Piping Systems", duration: 6, tradeId: "plumbing", crewSize: 5, dependsOnPrevious: false },
      { name: "Equipment Setting", duration: 3, tradeId: "hvac", crewSize: 4, dependsOnPrevious: true },
      { name: "Electrical Conduit", duration: 5, tradeId: "electrical", crewSize: 6, dependsOnPrevious: false },
      { name: "Cable Trays", duration: 4, tradeId: "electrical", crewSize: 4, dependsOnPrevious: true },
      { name: "Fire Protection", duration: 5, tradeId: "fireproofing", crewSize: 5, dependsOnPrevious: false },
      { name: "Controls and BMS", duration: 4, tradeId: "electrical", crewSize: 3, dependsOnPrevious: true },
      { name: "Testing and Balancing", duration: 3, tradeId: "hvac", crewSize: 2, dependsOnPrevious: true }
    ]
  },
  
  interiorzone: {
    name: "Interior Fitout Sequence",
    description: "Interior work sequence for commercial construction",
    aliases: ["interior", "fitout", "finish", "tenant improvement", "ti", "commercial interior", "interior_fitout"],
    tasks: [
      { name: "Framing", duration: 4, tradeId: "framing", crewSize: 6, dependsOnPrevious: false },
      { name: "In-Wall Utilities", duration: 5, tradeId: "electrical", crewSize: 5, dependsOnPrevious: true },
      { name: "Drywall Installation", duration: 5, tradeId: "drywall", crewSize: 8, dependsOnPrevious: true },
      { name: "Taping and Finishing", duration: 4, tradeId: "drywall", crewSize: 6, dependsOnPrevious: true },
      { name: "Ceiling Grid", duration: 3, tradeId: "carpentry", crewSize: 4, dependsOnPrevious: true },
      { name: "Flooring", duration: 4, tradeId: "flooring", crewSize: 5, dependsOnPrevious: false },
      { name: "Painting", duration: 4, tradeId: "painting", crewSize: 6, dependsOnPrevious: true },
      { name: "Doors and Hardware", duration: 2, tradeId: "carpentry", crewSize: 3, dependsOnPrevious: false },
      { name: "Fixtures and Trim", duration: 3, tradeId: "carpentry", crewSize: 4, dependsOnPrevious: true }
    ]
  },
  
  datacenterzone: {
    name: "Data Center Sequence",
    description: "Specialized work sequence for data center construction",
    aliases: ["datacenter", "server room", "it room", "computer room", "data hall", "data_center"],
    tasks: [
      { name: "Raised Floor System", duration: 4, tradeId: "flooring", crewSize: 5, dependsOnPrevious: false },
      { name: "Power Distribution", duration: 6, tradeId: "electrical", crewSize: 8, dependsOnPrevious: true },
      { name: "Precision Cooling", duration: 5, tradeId: "hvac", crewSize: 6, dependsOnPrevious: false },
      { name: "Fire Suppression", duration: 4, tradeId: "fireproofing", crewSize: 4, dependsOnPrevious: false },
      { name: "Cable Management", duration: 5, tradeId: "electrical", crewSize: 6, dependsOnPrevious: true },
      { name: "Security Systems", duration: 3, tradeId: "electrical", crewSize: 3, dependsOnPrevious: false },
      { name: "Server Rack Installation", duration: 4, tradeId: "electrical", crewSize: 5, dependsOnPrevious: true },
      { name: "Testing and Commissioning", duration: 5, tradeId: "management", crewSize: 4, dependsOnPrevious: true }
    ]
  },
  
  facadezone: {
    name: "Building Envelope Sequence",
    description: "Exterior envelope work sequence for a commercial building",
    aliases: ["facade", "exterior", "curtain wall", "envelope", "skin", "cladding", "building_envelope"],
    tasks: [
      { name: "Anchor Layout", duration: 3, tradeId: "framing", crewSize: 4, dependsOnPrevious: false },
      { name: "Curtain Wall Framing", duration: 5, tradeId: "framing", crewSize: 6, dependsOnPrevious: true },
      { name: "Glazing Installation", duration: 6, tradeId: "glazing", crewSize: 6, dependsOnPrevious: true },
      { name: "Metal Panel Installation", duration: 5, tradeId: "framing", crewSize: 5, dependsOnPrevious: false },
      { name: "Sealants and Flashings", duration: 4, tradeId: "roofing", crewSize: 4, dependsOnPrevious: true },
      { name: "Entrance Systems", duration: 3, tradeId: "glazing", crewSize: 4, dependsOnPrevious: false },
      { name: "Weather Barrier", duration: 2, tradeId: "roofing", crewSize: 3, dependsOnPrevious: false },
      { name: "Testing and Inspection", duration: 2, tradeId: "management", crewSize: 2, dependsOnPrevious: true }
    ]
  },
  
  // Add new Substation Build-Out Sequence template
  substation_build: {
    name: "Substation Build-Out Sequence",
    description: "Specialized work sequence for electrical substation construction",
    aliases: ["substation", "electrical substation", "power substation", "utility substation", "electricity substation", "substationsequence"],
    tasks: [
      { name: "Site Preparation & Grading", duration: 5, tradeId: "demolition", crewSize: 4, dependsOnPrevious: false },
      { name: "Foundation & Civil Works", duration: 7, tradeId: "concrete", crewSize: 6, dependsOnPrevious: true },
      { name: "Ground Grid & Conduit Installation", duration: 6, tradeId: "electrical", crewSize: 5, dependsOnPrevious: true },
      { name: "Structural Steel Erection", duration: 4, tradeId: "framing", crewSize: 6, dependsOnPrevious: true },
      { name: "Equipment Foundations", duration: 5, tradeId: "concrete", crewSize: 5, dependsOnPrevious: true },
      { name: "Major Equipment Installation", duration: 8, tradeId: "electrical", crewSize: 8, dependsOnPrevious: true },
      { name: "Control Building Construction", duration: 10, tradeId: "framing", crewSize: 6, dependsOnPrevious: false },
      { name: "Electrical Rough-In", duration: 7, tradeId: "electrical", crewSize: 7, dependsOnPrevious: true },
      { name: "Control & Protection Systems Installation", duration: 6, tradeId: "electrical", crewSize: 5, dependsOnPrevious: true },
      { name: "Electrical Wiring & Connections", duration: 8, tradeId: "electrical", crewSize: 8, dependsOnPrevious: true },
      { name: "Testing & Commissioning", duration: 5, tradeId: "electrical", crewSize: 4, dependsOnPrevious: true },
      { name: "Final Inspection & Punch List", duration: 3, tradeId: "management", crewSize: 3, dependsOnPrevious: true }
    ]
  },
};

/**
 * Get all available template names
 */
export function getTemplateNames(): string[] {
  return Object.keys(TEMPLATES);
}

/**
 * Get template name with its aliases as a string for display
 */
export function getTemplateWithAliases(templateKey: string): string {
  const template = TEMPLATES[templateKey];
  if (!template) return templateKey;
  
  if (template.aliases && template.aliases.length > 0) {
    return `${templateKey} (${template.aliases.join(', ')})`;
  }
  return templateKey;
}

/**
 * Get a template by name (case insensitive)
 */
export function getTemplate(name: string): SequenceTemplate | undefined {
  // Direct match by key
  const key = name.toLowerCase().trim();
  if (TEMPLATES[key]) return TEMPLATES[key];
  
  // Try to match by name or alias
  for (const [templateKey, template] of Object.entries(TEMPLATES)) {
    // Match by name
    if (template.name.toLowerCase() === key) {
      return template;
    }
    
    // Match by alias
    if (template.aliases && template.aliases.some(alias => 
      alias.toLowerCase() === key || key.includes(alias.toLowerCase())
    )) {
      return template;
    }
  }
  
  return undefined;
}

/**
 * Find templates that partially match a search term
 */
export function findTemplateMatches(searchTerm: string): string[] {
  const normalizedSearch = searchTerm.toLowerCase().trim();
  const matches: string[] = [];
  
  // First check for exact matches
  for (const [key, template] of Object.entries(TEMPLATES)) {
    // Check the key for exact match
    if (key.toLowerCase() === normalizedSearch) {
      return [key]; // Return immediately if we find an exact match
    }
    
    // Check the name for exact match
    if (template.name.toLowerCase() === normalizedSearch) {
      return [key]; // Return immediately if we find an exact match
    }
    
    // Check aliases for exact match
    if (template.aliases && template.aliases.some(alias => 
      alias.toLowerCase() === normalizedSearch
    )) {
      return [key]; // Return immediately if we find an exact match
    }
  }
  
  // Score-based partial matches
  type ScoredMatch = { key: string; score: number };
  const scoredMatches: ScoredMatch[] = [];
  
  // Match against all template keys, names and aliases with scoring
  for (const [key, template] of Object.entries(TEMPLATES)) {
    let score = 0;
    
    // Check the key
    if (key.toLowerCase() === normalizedSearch) {
      score += 100; // Exact key match gets highest score
    } else if (key.toLowerCase().includes(normalizedSearch)) {
      score += 50; // Partial key match
    } else if (normalizedSearch.includes(key.toLowerCase())) {
      score += 30; // Search term contains key
    }
    
    // Check the name
    if (template.name.toLowerCase() === normalizedSearch) {
      score += 90; // Exact name match
    } else if (template.name.toLowerCase().includes(normalizedSearch)) {
      score += 40; // Partial name match
    } else if (normalizedSearch.includes(template.name.toLowerCase())) {
      score += 25; // Search term contains name
    }
    
    // Check description for context clues
    if (template.description.toLowerCase().includes(normalizedSearch)) {
      score += 20; // Description contains search term
    }
    
    // Check aliases
    if (template.aliases) {
      for (const alias of template.aliases) {
        if (alias.toLowerCase() === normalizedSearch) {
          score += 80; // Exact alias match
        } else if (alias.toLowerCase().includes(normalizedSearch)) {
          score += 35; // Partial alias match
        } else if (normalizedSearch.includes(alias.toLowerCase())) {
          score += 20; // Search term contains alias
        }
        
        // Word-by-word matching for multi-word search terms
        const searchWords = normalizedSearch.split(/\s+/);
        if (searchWords.length > 1) {
          for (const word of searchWords) {
            if (word.length > 2 && alias.toLowerCase().includes(word)) { 
              score += 5; // Bonus for matching individual words in multi-word search
            }
          }
        }
      }
    }
    
    // If we have any score at all, add it to the results
    if (score > 0) {
      scoredMatches.push({ key, score });
    }
  }
  
  // Sort matches by score (descending)
  scoredMatches.sort((a, b) => b.score - a.score);
  
  // If we have high-confidence matches (score >= 30), filter out low-confidence ones
  const highConfidenceMatches = scoredMatches.filter(match => match.score >= 30);
  if (highConfidenceMatches.length > 0) {
    return highConfidenceMatches.map(match => match.key);
  }
  
  // Otherwise return all matches
  return scoredMatches.map(match => match.key);
} 