package com.novacloudedu.backend.infrastructure.persistence.repository;

import com.novacloudedu.backend.domain.ai.repository.KnowledgeChunkRepository;
import com.novacloudedu.backend.domain.ai.valueobject.KnowledgeBaseId;
import com.novacloudedu.backend.domain.ai.valueobject.KnowledgeDocumentId;
import com.novacloudedu.backend.infrastructure.persistence.mapper.KnowledgeChunkMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Repository
@RequiredArgsConstructor
public class KnowledgeChunkRepositoryImpl implements KnowledgeChunkRepository {

    private static final int DB_BATCH_SIZE = 1000;

    private final KnowledgeChunkMapper mapper;

    @Override
    public void saveChunk(KnowledgeBaseId knowledgeBaseId, KnowledgeDocumentId documentId,
                          String content, int chunkIndex, float[] embedding, String metadata) {
        String embeddingStr = floatArrayToString(embedding);
        mapper.insertChunk(knowledgeBaseId.value(), documentId.value(), content, chunkIndex,
                null, null, null, embeddingStr, metadata);
    }

    @Override
    public void saveChunks(KnowledgeBaseId knowledgeBaseId, KnowledgeDocumentId documentId,
                           List<String> contents, List<float[]> embeddings, String metadata) {
        List<Map<String, Object>> allRows = new ArrayList<>();
        for (int i = 0; i < contents.size(); i++) {
            Map<String, Object> row = new java.util.HashMap<>();
            row.put("knowledgeBaseId", knowledgeBaseId.value());
            row.put("documentId", documentId.value());
            row.put("content", contents.get(i));
            row.put("chunkIndex", i);
            row.put("parentChunkId", null);
            row.put("isParentChunk", null);
            row.put("sectionTitle", null);
            row.put("embedding", floatArrayToString(embeddings.get(i)));
            row.put("metadata", metadata);
            allRows.add(row);
        }

        for (int start = 0; start < allRows.size(); start += DB_BATCH_SIZE) {
            int end = Math.min(start + DB_BATCH_SIZE, allRows.size());
            mapper.batchInsertChunks(allRows.subList(start, end));
        }
    }

    @Override
    public List<ChunkSearchResult> searchSimilar(KnowledgeBaseId knowledgeBaseId, float[] queryEmbedding, int topK) {
        String embeddingStr = floatArrayToString(queryEmbedding);
        return mapper.searchSimilar(knowledgeBaseId.value(), embeddingStr, topK).stream()
                .map(this::mapToResult)
                .collect(Collectors.toList());
    }

    @Override
    public List<ChunkSearchResult> searchSimilarInMultiple(List<Long> knowledgeBaseIds, float[] queryEmbedding, int topK) {
        if (knowledgeBaseIds == null || knowledgeBaseIds.isEmpty()) {
            return new ArrayList<>();
        }
        String embeddingStr = floatArrayToString(queryEmbedding);
        return mapper.searchSimilarInMultiple(knowledgeBaseIds, embeddingStr, topK).stream()
                .map(this::mapToResult)
                .collect(Collectors.toList());
    }

    @Override
    public List<ChunkSearchResult> fullTextSearchInMultiple(List<Long> knowledgeBaseIds, String query, int topK) {
        if (knowledgeBaseIds == null || knowledgeBaseIds.isEmpty() || query == null || query.trim().isEmpty()) {
            return new ArrayList<>();
        }

        try {
            List<Map<String, Object>> results = mapper.fullTextSearchInMultiple(knowledgeBaseIds, query, topK);
            if (results != null && !results.isEmpty()) {
                return results.stream().map(this::mapToResult).collect(Collectors.toList());
            }

            List<Map<String, Object>> trigramResults = mapper.trigramSearchInMultiple(knowledgeBaseIds, query, topK);
            if (trigramResults != null && !trigramResults.isEmpty()) {
                return trigramResults.stream().map(this::mapToResult).collect(Collectors.toList());
            }
        } catch (Exception e) {
            log.warn("Full-text recall failed, fallback to local lexical search: {}", e.getMessage());
        }

        return localLexicalSearch(knowledgeBaseIds, query, topK);
    }

    private List<ChunkSearchResult> localLexicalSearch(List<Long> knowledgeBaseIds, String query, int topK) {
        List<Map<String, Object>> candidates = mapper.listSearchCandidatesInMultiple(knowledgeBaseIds, 800);
        Set<String> terms = buildSearchTerms(query);
        if (terms.isEmpty()) {
            return new ArrayList<>();
        }

        return candidates.stream()
                .map(this::mapToResult)
                .map(result -> new ChunkSearchResult(
                        result.chunkId(),
                        result.knowledgeBaseId(),
                        result.documentId(),
                        result.content(),
                        lexicalScore(result.content(), terms),
                        result.metadata()))
                .filter(result -> result.similarity() > 0)
                .sorted(Comparator.comparingDouble(ChunkSearchResult::similarity).reversed())
                .limit(topK)
                .collect(Collectors.toList());
    }

    private Set<String> buildSearchTerms(String query) {
        String normalized = query == null ? "" : query.toLowerCase();
        Set<String> terms = new HashSet<>();
        for (String token : normalized.split("[^a-z0-9\\u4e00-\\u9fa5+#]+")) {
            if (token.length() >= 2) {
                terms.add(token);
            }
            for (int len : new int[]{2, 3, 4}) {
                if (token.length() >= len) {
                    for (int i = 0; i <= token.length() - len; i++) {
                        terms.add(token.substring(i, i + len));
                    }
                }
            }
        }
        return terms;
    }

    private double lexicalScore(String content, Set<String> terms) {
        String text = content == null ? "" : content.toLowerCase();
        if (text.isEmpty()) {
            return 0;
        }

        double score = 0;
        for (String term : terms) {
            if (text.contains(term)) {
                score += Math.min(0.18, 0.04 + term.length() * 0.015);
            }
        }
        return Math.min(0.98, score);
    }

    @Override
    public void deleteByDocumentId(KnowledgeDocumentId documentId) {
        mapper.deleteByDocumentId(documentId.value());
    }

    @Override
    public void deleteByKnowledgeBaseId(KnowledgeBaseId knowledgeBaseId) {
        mapper.deleteByKnowledgeBaseId(knowledgeBaseId.value());
    }

    @Override
    public List<ChunkDetail> findByDocumentId(KnowledgeDocumentId documentId, int page, int size) {
        int offset = page * size;
        return mapper.findByDocumentId(documentId.value(), offset, size).stream()
                .map(this::mapToChunkDetail)
                .collect(Collectors.toList());
    }

    @Override
    public long countByDocumentId(KnowledgeDocumentId documentId) {
        return mapper.countByDocumentId(documentId.value());
    }

    @Override
    public long countByKnowledgeBaseId(KnowledgeBaseId knowledgeBaseId) {
        return mapper.countByKnowledgeBaseId(knowledgeBaseId.value());
    }

    private String floatArrayToString(float[] array) {
        if (array == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < array.length; i++) {
            if (i > 0) {
                sb.append(",");
            }
            sb.append(array[i]);
        }
        sb.append("]");
        return sb.toString();
    }

    private ChunkDetail mapToChunkDetail(Map<String, Object> map) {
        return new ChunkDetail(
                ((Number) map.get("id")).longValue(),
                ((Number) map.get("knowledge_base_id")).longValue(),
                ((Number) map.get("document_id")).longValue(),
                (String) map.get("content"),
                map.get("chunk_index") != null ? ((Number) map.get("chunk_index")).intValue() : 0,
                map.get("parent_chunk_id") != null ? ((Number) map.get("parent_chunk_id")).longValue() : null,
                map.get("is_parent_chunk") != null ? (Boolean) map.get("is_parent_chunk") : false,
                (String) map.get("section_title"),
                convertMetadataToString(map.get("metadata")),
                map.get("create_time") != null ? ((java.sql.Timestamp) map.get("create_time")).toLocalDateTime() : null
        );
    }

    private ChunkSearchResult mapToResult(Map<String, Object> map) {
        return new ChunkSearchResult(
                ((Number) map.get("id")).longValue(),
                ((Number) map.get("knowledge_base_id")).longValue(),
                ((Number) map.get("document_id")).longValue(),
                (String) map.get("content"),
                ((Number) map.get("similarity")).doubleValue(),
                convertMetadataToString(map.get("metadata"))
        );
    }

    private String convertMetadataToString(Object metadata) {
        if (metadata == null) {
            return null;
        }
        if (metadata instanceof String) {
            return (String) metadata;
        }
        try {
            return new com.google.gson.Gson().toJson(metadata);
        } catch (Exception e) {
            return metadata.toString();
        }
    }
}
