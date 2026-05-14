import { BaseRepository } from './base.repository';
import { Model, Document } from 'mongoose';

// Mock interface for our dummy entity
interface DummyEntity {
  id: string;
  name: string;
}

// Dummy implementation of the abstract base repository
class DummyRepository extends BaseRepository<DummyEntity, any> {
  upsert(item: DummyEntity): Promise<DummyEntity> {
    return Promise.resolve(item);
  }
  protected mapToEntity(doc: any): DummyEntity {
    return {
      id: doc._id || doc.id,
      name: doc.name,
    };
  }
}

describe('BaseRepository', () => {
  let repository: DummyRepository;
  let mockModel: any;

  beforeEach(() => {
    // Basic Mongoose Model Mock
    mockModel = function(this: any, data: any) {
      Object.assign(this, data);
      this.save = jest.fn().mockResolvedValue(this);
    } as any;

    mockModel.findById = jest.fn();
    mockModel.find = jest.fn();
    mockModel.findByIdAndDelete = jest.fn();
    mockModel.findByIdAndUpdate = jest.fn();
    mockModel.findOne = jest.fn();

    repository = new DummyRepository(mockModel as Model<any>);
  });

  describe('findById', () => {
    it('should return null if not found', async () => {
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      const result = await repository.findById('1');
      expect(result).toBeNull();
    });

    it('should return mapped entity if found', async () => {
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ id: '1', name: 'Test' }) });
      const result = await repository.findById('1');
      expect(result).toEqual({ id: '1', name: 'Test' });
    });
  });

  describe('findAll', () => {
    it('should return an array of mapped entities', async () => {
      mockModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([{ id: '1', name: 'Test 1' }, { id: '2', name: 'Test 2' }]) });
      const result = await repository.findAll();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: '1', name: 'Test 1' });
    });
  });

  describe('delete', () => {
    it('should return true if document was deleted', async () => {
      mockModel.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue({ id: '1' }) });
      const result = await repository.delete('1');
      expect(result).toBe(true);
    });

    it('should return false if document was not found', async () => {
      mockModel.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      const result = await repository.delete('1');
      expect(result).toBe(false);
    });
  });

  describe('create', () => {
    it('should create and return the new entity', async () => {
      const result = await repository.create({ name: 'New Entity' });
      expect(result.name).toBe('New Entity');
    });
  });

  describe('update', () => {
    it('should update and return the updated entity', async () => {
      mockModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({ id: '1', name: 'Updated Entity' }) });
      const result = await repository.update('1', { name: 'Updated Entity' });
      expect(result).toEqual({ id: '1', name: 'Updated Entity' });
    });

    it('should return null if entity to update is not found', async () => {
      mockModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      const result = await repository.update('1', { name: 'Updated Entity' });
      expect(result).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should return entity matching the filter', async () => {
      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ id: '1', name: 'Test' }) });
      const result = await repository.findOne({ name: 'Test' });
      expect(result).toEqual({ id: '1', name: 'Test' });
    });
  });
});
