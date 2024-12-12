export interface PersonPayload {
    // Added for v2
    personId: string; // UUID - keep for v2
    personRole: 'USER' | 'CONSULTANT'; // eNum {'USER','CONSULTANT'} - keep for v2
    personPreferredName: string; // Preferred - keep for v2
    personPicture: string; // Optional - keep for v2
    userOrgId: string; // Foreign Key - keep for v2
    exp: number; // Token expiration time // keep for v2
    personHomeDomain: string; // Domain of the user // keep for v2
    userOrgShortName?: string;
    consultantOrgId?: string;
    consultantOrgShortName?: string; // present only if consultantOrgId exists
}