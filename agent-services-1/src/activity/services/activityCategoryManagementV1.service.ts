import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentActivityCategory } from '../entities/ob1-agent-activityCategory.entity';
import { OB1Activity } from '../interfaces/activity.interface';

@Injectable()
export class ActivityCategoryManagementV1Service {
    private readonly logger = new Logger(ActivityCategoryManagementV1Service.name);
    constructor(
        @InjectRepository(OB1AgentActivityCategory)
        private readonly categoryRepository: Repository<OB1AgentActivityCategory>,
    ) { }

    // Create Activity Category
    async createCategory(
        createCategoryDto: OB1Activity.CreateCategory,
    ): Promise<OB1Activity.ServiceResponse<OB1Activity.CategoryResponse>> {
        try {
            //this.logger.log(`createCategoryDto: ${JSON.stringify(createCategoryDto, null, 2)}`);
            // Manually map the consultantOrgShortName to the appropriate field
            const transformedCategoryDto = {
                ...createCategoryDto,
                activityCategoryCreatedByPersonId: createCategoryDto.personId,
                activityCategoryCreatedByConsultantOrgShortName: createCategoryDto.consultantOrgShortName,
            };

            const category = this.categoryRepository.create(transformedCategoryDto);
            const savedCategory = await this.categoryRepository.save(category);

            return {
                success: true,
                data: this.mapToCategoryResponse(savedCategory),
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'CATEGORY_CREATION_FAILED',
                    message: 'Failed to create activity category',
                    details: { error: error.message },
                },
            };
        }
    }

    // Get All Activity Categories
    async getCategories(): Promise<OB1Activity.ServiceResponse<OB1Activity.CategoryResponse[]>> {
        try {
            const categories = await this.categoryRepository.find();

            return {
                success: true,
                data: categories.map(this.mapToCategoryResponse),
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'CATEGORY_FETCH_FAILED',
                    message: 'Failed to fetch activity categories',
                    details: { error: error.message },
                },
            };
        }
    }

    // Get Single Activity Category by ID
    async getCategory(
        id: string,
    ): Promise<OB1Activity.ServiceResponse<OB1Activity.CategoryResponse>> {
        try {
            const category = await this.categoryRepository.findOne({ where: { activityCategoryId: id } });

            if (!category) {
                return {
                    success: false,
                    error: {
                        code: 'CATEGORY_NOT_FOUND',
                        message: `Category with ID ${id} not found`,
                    },
                };
            }

            return {
                success: true,
                data: this.mapToCategoryResponse(category),
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'CATEGORY_FETCH_FAILED',
                    message: 'Failed to fetch activity category',
                    details: { error: error.message },
                },
            };
        }
    }

    // Update Activity Category
    async updateCategory(
        id: string,
        updateCategoryDto: OB1Activity.UpdateCategory,
    ): Promise<OB1Activity.ServiceResponse<OB1Activity.CategoryResponse>> {
        try {
            const category = await this.categoryRepository.findOne({ where: { activityCategoryId: id } });

            if (!category) {
                return {
                    success: false,
                    error: {
                        code: 'CATEGORY_NOT_FOUND',
                        message: `Category with ID ${id} not found`,
                    },
                };
            }

            Object.assign(category, updateCategoryDto);
            const updatedCategory = await this.categoryRepository.save(category);

            return {
                success: true,
                data: this.mapToCategoryResponse(updatedCategory),
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'CATEGORY_UPDATE_FAILED',
                    message: 'Failed to update activity category',
                    details: { error: error.message },
                },
            };
        }
    }

    // Delete Activity Category
    async deleteCategory(id: string): Promise<OB1Activity.ServiceResponse<void>> {
        try {
            const result = await this.categoryRepository.delete(id);

            if (result.affected === 0) {
                return {
                    success: false,
                    error: {
                        code: 'CATEGORY_NOT_FOUND',
                        message: `Category with ID ${id} not found`,
                    },
                };
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'CATEGORY_DELETE_FAILED',
                    message: 'Failed to delete activity category',
                    details: { error: error.message },
                },
            };
        }
    }

    // Helper Method: Map to Category Response
    private mapToCategoryResponse(
        category: OB1AgentActivityCategory,
    ): OB1Activity.CategoryResponse {
        return {
            activityCategoryId: category.activityCategoryId,
            activityCategoryName: category.activityCategoryName,
            activityCategoryDescription: category.activityCategoryDescription,
            activityCategoryCreatedBypersonId: category.activityCategoryCreatedByPersonId,
            activityCategoryCreatedByConsultantOrgShortName: category.activityCategoryCreatedByConsultantOrgShortName,
        };
    }
}
