import { prisma } from './prisma';

/**
 * Checks if a user is blocked.
 * @param userId The ID of the user to check
 * @returns Promise<boolean> true if the user is blocked, false otherwise
 */
export async function isUserBlocked(userId: number): Promise<boolean> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isblocked: true }
        });
        return !!user?.isblocked;
    } catch (error) {
        console.error(`Error checking if user ${userId} is blocked:`, error);
        return false; // Default to false on error to avoid blocking actions unintentionally, or true if safety-first
    }
}
