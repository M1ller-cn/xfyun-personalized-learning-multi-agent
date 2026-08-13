# ChatRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**message** | **string** |  | [default to undefined]
**history** | **Array&lt;{ [key: string]: string; }&gt;** |  | [optional] [default to undefined]
**systemPrompt** | **string** |  | [optional] [default to undefined]
**imageUrls** | **Array&lt;string&gt;** |  | [optional] [default to undefined]
**modelId** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { ChatRequest } from './api';

const instance: ChatRequest = {
    message,
    history,
    systemPrompt,
    imageUrls,
    modelId,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
